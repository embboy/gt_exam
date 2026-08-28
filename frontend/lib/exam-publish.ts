import type { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { CompositionError, pairKey, selectComposition } from "@/lib/exam-composition";

export class PublishError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

export async function composeAndPublish(examId: bigint, actorId: bigint, traceId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const exam = await tx.mockExam.findUnique({ where: { id: examId }, include: { sessions: true } });
      if (!exam) throw new PublishError(404, "EXAM_NOT_FOUND", "Exam not found");
      if (exam.status !== "DRAFT") throw new PublishError(409, "EXAM_NOT_DRAFT", "Only draft exams can be composed and published");
      const subjects = await tx.subject.findMany({ where: { examStage: exam.examStage }, orderBy: { displayOrder: "asc" } });
      if (!subjects.length || !exam.sessions.length) throw new PublishError(422, "EXAM_BLUEPRINT_INVALID", "Exam subjects or sessions are missing");
      const sourceTypes = exam.examKind === "PAST_EXAM" ? ["PAST_EXAM"] : ["AI_DERIVED", "EDITORIAL"];
      const questions = await tx.question.findMany({
        where: { subjectId: { in: subjects.map((subject) => subject.id) }, status: "APPROVED", sourceType: { in: sourceTypes }, currentVersionId: { not: null } },
      });
      const versions = await tx.questionVersion.findMany({
        where: { id: { in: questions.flatMap((question) => question.currentVersionId ? [question.currentVersionId] : []) }, examReferenceDate: { lte: exam.legalReferenceDate } },
      });
      const versionById = new Map(versions.map((version) => [version.id, version]));
      const used = await tx.mockExamQuestion.findMany({ where: { officialSlot: true }, select: { questionId: true } });
      const usedIds = new Set(used.map((item) => item.questionId));
      const candidates = questions.flatMap((question) => {
        const version = question.currentVersionId && versionById.get(question.currentVersionId);
        if (!version || usedIds.has(question.id)) return [];
        return [{ questionId: question.id, subjectId: question.subjectId, topicId: question.topicId, questionVersionId: version.id, difficulty: version.difficulty, normalizedHash: version.normalizedHash }];
      });
      const candidateIds = candidates.map((candidate) => candidate.questionId);
      const similarities = await tx.questionSimilarity.findMany({
        where: { decision: "BLOCK", OR: [
          { lowerQuestionId: { in: candidateIds } },
          { higherQuestionId: { in: candidateIds } },
        ] },
      });
      const allowedIds = new Set(candidateIds);
      const blockedPairs = new Set<string>();
      for (const item of similarities) {
        if (usedIds.has(item.lowerQuestionId) || usedIds.has(item.higherQuestionId)) {
          allowedIds.delete(usedIds.has(item.lowerQuestionId) ? item.higherQuestionId : item.lowerQuestionId);
        } else {
          blockedPairs.add(pairKey(item.lowerQuestionId, item.higherQuestionId));
        }
      }
      const selected = selectComposition(candidates.filter((candidate) => allowedIds.has(candidate.questionId)), subjects.map((subject) => subject.id), blockedPairs);
      if (new Set(selected.map((candidate) => candidate.normalizedHash)).size !== selected.length) {
        throw new PublishError(422, "QUESTION_HASH_DUPLICATE", "Question versions have duplicate normalized hashes");
      }
      const sessionByNo = new Map(exam.sessions.map((session) => [session.sessionNo, session.id]));
      await tx.mockExamQuestion.createMany({ data: selected.map((candidate, index) => ({
        examId: exam.id, examSessionId: sessionByNo.get(subjects.find((subject) => subject.id === candidate.subjectId)?.sessionNo ?? 0)!,
        subjectId: candidate.subjectId, questionId: candidate.questionId, questionVersionId: candidate.questionVersionId,
        questionNo: selected.filter((item) => item.subjectId === candidate.subjectId).findIndex((item) => item.questionId === candidate.questionId) + 1,
        officialSlot: true,
      })) });
      await tx.mockExam.update({ where: { id: exam.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: actorId, actorType: "ADMIN", action: "EXAM_PUBLISHED", targetType: "mock_exam", targetId: exam.id.toString(), afterValue: { examKind: exam.examKind, stage: exam.examStage, setNo: exam.setNo, questionCount: selected.length }, traceId } });
      return { examId: Number(exam.id), examKind: exam.examKind, stage: exam.examStage, setNo: exam.setNo, questionCount: selected.length };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof PublishError || error instanceof CompositionError) {
      if (error instanceof CompositionError) throw new PublishError(422, error.code, error.message);
      throw error;
    }
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw new PublishError(409, "QUESTION_ALREADY_USED", "A selected question was published by another request");
    }
    throw error;
  }
}