import "dotenv/config";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import prisma from "../lib/prisma";

type AnswerKey = { year: number; examNo: number; stage: 1; session: 1; form: string; answers: number[][]; answerEvidence: { articleId: string; page: number; source: string } };
type OfficialAnswer = { year: number; exam_no: number; article_id: string; article_url: string; sha256: string; license: string };

function hash(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function validateKey(key: AnswerKey) {
  if (key.answers.length !== 80 || key.answers.some((answers) => !answers.length || answers.some((answer) => !Number.isInteger(answer) || answer < 1 || answer > 5))) {
    throw new Error(`${key.year} answer key must contain 80 non-empty 1-5 answer sets`);
  }
}

async function main() {
  const root = resolve(import.meta.dirname, "../..");
  const keys = JSON.parse(readFileSync(resolve(root, "data/processed/official-answer-keys.json"), "utf8")) as AnswerKey[];
  const officialAnswers = JSON.parse(readFileSync(resolve(root, "data/processed/qnet-answer-manifest.json"), "utf8")) as OfficialAnswer[];

  for (const key of keys) {
    validateKey(key);
    const paperPath = resolve(root, "frontend/public/past-exams", `${key.year}.pdf`);
    let paperSha256: string;
    try {
      paperSha256 = hash(readFileSync(paperPath));
    } catch {
      throw new Error(`Missing original PDF asset for ${key.year}: ${paperPath}`);
    }
    const answer = officialAnswers.find((item) => item.year === key.year && item.exam_no === key.examNo && item.article_id === key.answerEvidence.articleId && item.license === "KOGL_TYPE_1");
    if (!answer) throw new Error(`Missing verified final-answer evidence for ${key.year}`);

    await prisma.$transaction(async (tx) => {
      const source = await tx.sourceDocument.upsert({
        where: { sourceKind_examYear_checksumSha256: { sourceKind: "PAST_EXAM", examYear: key.year, checksumSha256: paperSha256 } },
        create: {
          sourceKind: "PAST_EXAM", examYear: key.year, title: `${key.year}년 제${key.examNo}회 제1차 1교시 ${key.form}형`,
          publisher: "User-provided local PDF", checksumSha256: paperSha256, rightsStatus: "RIGHTS_VERIFIED",
          rightsNote: `Question paper and final-answer evidence: ${answer.article_url}, SHA-256 ${answer.sha256}. ${key.answerEvidence.source}`,
        },
        update: { rightsStatus: "RIGHTS_VERIFIED", rightsNote: `Question paper and final-answer evidence: ${answer.article_url}, SHA-256 ${answer.sha256}. ${key.answerEvidence.source}` },
      });
      const answerSource = await tx.sourceDocument.upsert({
        where: { sourceKind_examYear_checksumSha256: { sourceKind: "PAST_EXAM", examYear: key.year, checksumSha256: answer.sha256 } },
        create: {
          sourceKind: "PAST_EXAM", examYear: key.year, title: `${key.year}년 제${key.examNo}회 제1차 최종정답`, sourceUrl: answer.article_url,
          publisher: "Q-Net", checksumSha256: answer.sha256, rightsStatus: "RIGHTS_VERIFIED", rightsNote: `${answer.license}; ${key.answerEvidence.source}`,
        },
        update: { sourceUrl: answer.article_url, rightsStatus: "RIGHTS_VERIFIED", rightsNote: `${answer.license}; ${key.answerEvidence.source}` },
      });
      const answerEvidence = await tx.sourceImportItem.upsert({
        where: { sourceDocumentId_sourceItemKey: { sourceDocumentId: answerSource.id, sourceItemKey: `ANSWER_PAGE:${key.answerEvidence.page}:${key.form}` } },
        create: {
          sourceDocumentId: answerSource.id, sourceItemKey: `ANSWER_PAGE:${key.answerEvidence.page}:${key.form}`, recordType: "ANSWER_PAGE", pageNo: key.answerEvidence.page,
          rawText: `${key.year}년 제${key.examNo}회 제1차 ${key.form}형 공식 최종정답`, sourceCoordinates: { page: key.answerEvidence.page, form: key.form },
          payload: { articleId: key.answerEvidence.articleId, articleUrl: answer.article_url, sha256: answer.sha256, license: answer.license }, reviewStatus: "ACCEPTED",
        },
        update: { rawText: `${key.year}년 제${key.examNo}회 제1차 ${key.form}형 공식 최종정답`, payload: { articleId: key.answerEvidence.articleId, articleUrl: answer.article_url, sha256: answer.sha256, license: answer.license }, reviewStatus: "ACCEPTED", updatedAt: new Date() },
      });
      const subjects = await tx.subject.findMany({ where: { examStage: 1 }, orderBy: { displayOrder: "asc" } });
      if (subjects.length !== 2) throw new Error("First-stage subject definitions are missing");
      const exam = await tx.mockExam.upsert({
        where: { examKind_examStage_setNo: { examKind: "PAST_EXAM", examStage: 1, setNo: key.year - 2016 } },
        create: { examKind: "PAST_EXAM", examStage: 1, setNo: key.year - 2016, title: `${key.year}년 제${key.examNo}회 제1차 기출`, status: "DRAFT", legalReferenceDate: new Date(`${key.year}-10-31`), sourceExamYear: key.year, sourcePdfUrl: `/past-exams/${key.year}.pdf`, isHistoricalPaper: true },
        update: { title: `${key.year}년 제${key.examNo}회 제1차 기출`, sourceExamYear: key.year, sourcePdfUrl: `/past-exams/${key.year}.pdf`, isHistoricalPaper: true },
      });
      const session = await tx.mockExamSession.upsert({ where: { examId_sessionNo: { examId: exam.id, sessionNo: 1 } }, create: { examId: exam.id, sessionNo: 1, durationMinutes: 100 }, update: { durationMinutes: 100 } });
      const existing = await tx.mockExamQuestion.groupBy({ by: ["subjectId"], where: { examId: exam.id }, _count: true });
      if (existing.length !== 0) {
        const complete = existing.length === 2 && existing.every((item) => item._count === 40) && exam.status === "PUBLISHED";
        if (!complete) throw new Error(`Existing paper practice exam ${key.year} is incomplete and must be repaired manually`);
        return;
      }

      for (let index = 0; index < 80; index += 1) {
        const subject = subjects[Math.floor(index / 40)];
        const sourceItemNo = String(index + 1);
        const question = await tx.question.upsert({
          where: { sourceDocumentId_sourceItemNo: { sourceDocumentId: source.id, sourceItemNo } },
          create: { subjectId: subject.id, sourceDocumentId: source.id, sourceItemNo, sourceType: "PAST_EXAM", status: "APPROVED" },
          update: { status: "APPROVED" },
        });
        const version = await tx.questionVersion.create({ data: {
          questionId: question.id, versionNo: 1, difficulty: 3, stem: `원문 PDF ${index + 1}번`, option1: "1", option2: "2", option3: "3", option4: "4", option5: "5",
          correctAnswer: key.answers[index][0], explanation: `Q-Net ${key.year}년 제${key.examNo}회 최종정답 기준`, examReferenceDate: new Date(`${key.year}-10-31`), normalizedHash: hash(`${paperSha256}:${index + 1}`), answerEvidenceImportItemId: answerEvidence.id,
        } });
        await tx.questionVersionAcceptedAnswer.createMany({ data: key.answers[index].map((answerValue) => ({ questionVersionId: version.id, answer: answerValue })) });
        await tx.question.update({ where: { id: question.id }, data: { currentVersionId: version.id } });
        await tx.mockExamQuestion.create({ data: { examId: exam.id, examSessionId: session.id, subjectId: subject.id, questionId: question.id, questionVersionId: version.id, questionNo: (index % 40) + 1, officialSlot: true } });
      }
      const linked = await tx.mockExamQuestion.groupBy({ by: ["subjectId"], where: { examId: exam.id }, _count: true });
      if (linked.length !== 2 || linked.some((item) => item._count !== 40)) throw new Error(`Paper practice exam ${key.year} must contain 40 questions per subject`);
      await tx.mockExam.update({ where: { id: exam.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    }, { isolationLevel: "Serializable" });
    console.log(`Imported ${key.year} first-stage paper practice exam`);
  }
}

main().finally(() => prisma.$disconnect());