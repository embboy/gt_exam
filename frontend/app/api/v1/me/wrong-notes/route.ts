import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth";
import { safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const principal = await authenticate(request);
  if (!principal) return NextResponse.json({ code: "AUTHENTICATION_REQUIRED", message: "A valid bearer token is required" }, { status: 401 });
  const notes = await prisma.wrongNote.findMany({ where: { userId: principal.userId }, orderBy: { updatedAt: "desc" } });
  const questionIds = notes.map((note) => note.questionId);
  const [histories, questions] = await Promise.all([
    prisma.wrongHistory.findMany({ where: { userId: principal.userId, questionId: { in: questionIds } }, orderBy: { attemptedAt: "desc" } }),
    prisma.question.findMany({ where: { id: { in: questionIds } } }),
  ]);
  const latestHistory = new Map<bigint, typeof histories[number]>();
  for (const history of histories) if (!latestHistory.has(history.questionId)) latestHistory.set(history.questionId, history);
  const versions = await prisma.questionVersion.findMany({ where: { id: { in: histories.map((history) => history.questionVersionId) } } });
  const versionById = new Map(versions.map((version) => [version.id, version]));
  const subjectIds = [...new Set(questions.map((question) => question.subjectId))];
  const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } } });
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

  const items = notes.flatMap((note) => {
    const history = latestHistory.get(note.questionId);
    const question = questionById.get(note.questionId);
    const version = history && versionById.get(history.questionVersionId);
    const subject = question && subjectById.get(question.subjectId);
    if (!history || !question || !version || !subject) return [];
    return [{
      questionId: safeId(note.questionId), subjectCode: subject.code, subjectName: subject.name,
      stem: version.stem, options: [version.option1, version.option2, version.option3, version.option4, version.option5],
      correctAnswer: version.correctAnswer, explanation: version.explanation, selectedAnswer: history.selectedAnswer,
      wrongCount: histories.filter((item) => item.questionId === note.questionId).length,
      reviewStatus: note.reviewStatus, note: note.note, lastAttemptedAt: history.attemptedAt.toISOString(),
    }];
  });
  const summary = Object.values(items.reduce<Record<string, { subjectCode: string; subjectName: string; wrongCount: number }>>((result, item) => {
    const existing = result[item.subjectCode] ?? { subjectCode: item.subjectCode, subjectName: item.subjectName, wrongCount: 0 };
    existing.wrongCount += 1;
    result[item.subjectCode] = existing;
    return result;
  }, {}));
  return NextResponse.json({ items, summary });
}