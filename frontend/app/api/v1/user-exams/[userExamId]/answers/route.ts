import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticate } from "@/lib/auth";
import { AttemptError, saveAnswer } from "@/lib/attempts";
import { apiError, parseId, safeId } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const answerSchema = z.object({
  examQuestionId: z.union([z.string(), z.number().int().positive()]).transform(String),
  selectedAnswer: z.number().int().min(1).max(5),
  expectedVersion: z.union([z.string(), z.number().int().nonnegative()]).transform(String),
  requestId: z.uuid(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userExamId: string }> },
) {
  const principal = await authenticate(request);
  if (!principal) {
    return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  }
  const userExamId = parseId((await params).userExamId);
  const parsed = answerSchema.safeParse(await request.json().catch(() => null));
  const examQuestionId = parsed.success ? parseId(parsed.data.examQuestionId) : null;
  const expectedVersion = parsed.success && /^\d+$/.test(parsed.data.expectedVersion)
    ? BigInt(parsed.data.expectedVersion)
    : null;
  if (!userExamId || !parsed.success || !examQuestionId || expectedVersion === null) {
    return apiError(400, "VALIDATION_FAILED", "Invalid answer request");
  }

  try {
    const answer = await saveAnswer({
      userExamId,
      userId: principal.userId,
      examQuestionId,
      selectedAnswer: parsed.data.selectedAnswer,
      expectedVersion,
      requestId: parsed.data.requestId,
    });
    return NextResponse.json({
      examQuestionId: safeId(answer.examQuestionId),
      selectedAnswer: answer.selectedAnswer,
      version: safeId(answer.answerVersion),
      savedAt: answer.answeredAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof AttemptError) {
      return apiError(error.status, error.code, error.message);
    }
    throw error;
  }
}