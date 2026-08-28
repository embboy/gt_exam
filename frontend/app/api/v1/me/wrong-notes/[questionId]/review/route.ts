import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticate } from "@/lib/auth";
import { apiError, parseId, safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const reviewSchema = z.object({
  reviewStatus: z.enum(["NEW", "REVIEWING", "MASTERED"]),
  note: z.string().trim().max(10_000).nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ questionId: string }> }) {
  const principal = await authenticate(request);
  if (!principal) return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  const questionId = parseId((await params).questionId);
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!questionId || !parsed.success) return apiError(400, "VALIDATION_FAILED", "Invalid wrong-note review request");
  const existing = await prisma.wrongNote.findUnique({ where: { userId_questionId: { userId: principal.userId, questionId } } });
  if (!existing) return apiError(404, "WRONG_NOTE_NOT_FOUND", "Wrong note not found");
  const reviewedAt = parsed.data.reviewStatus === "MASTERED" ? new Date() : existing.lastReviewedAt;
  const note = await prisma.wrongNote.update({
    where: { userId_questionId: { userId: principal.userId, questionId } },
    data: { reviewStatus: parsed.data.reviewStatus, note: parsed.data.note, lastReviewedAt: reviewedAt, updatedAt: new Date() },
  });
  return NextResponse.json({ questionId: safeId(note.questionId), reviewStatus: note.reviewStatus, note: note.note, lastReviewedAt: note.lastReviewedAt?.toISOString() ?? null });
}