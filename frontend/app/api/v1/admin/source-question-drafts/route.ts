import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticate, canReviewQuestions } from "@/lib/auth";
import { apiError, safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const id = z.union([z.string(), z.number().int().positive()]).transform((value) => BigInt(value));
const draftSchema = z.object({
  sourceImportItemId: id,
  subjectId: id,
  sourceQuestionNo: z.number().int().min(1).max(40),
  stem: z.string().trim().min(10),
  options: z.array(z.string().trim().min(1)).length(5),
  proposedAnswer: z.number().int().min(1).max(5).nullable(),
  answerEvidenceImportItemId: id.nullable(),
  difficulty: z.number().int().min(1).max(5),
  explanation: z.string().trim(),
  examReferenceDate: z.coerce.date(),
});

export async function POST(request: NextRequest) {
  const principal = await authenticate(request);
  if (!principal) return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  if (!canReviewQuestions(principal)) return apiError(403, "FORBIDDEN", "Question reviewer access is required");
  const parsed = draftSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "VALIDATION_FAILED", "Invalid question review draft");
  const input = parsed.data;
  if (new Set(input.options.map((option) => option.normalize("NFKC").toLowerCase())).size !== 5) {
    return apiError(400, "VALIDATION_FAILED", "Answer options must be distinct");
  }

  const sourceItem = await prisma.sourceImportItem.findUnique({
    where: { id: input.sourceImportItemId }, include: { sourceDocument: true },
  });
  if (!sourceItem || sourceItem.recordType !== "OCR_COLUMN" || sourceItem.sourceDocument.rightsStatus !== "RIGHTS_VERIFIED") {
    return apiError(422, "SOURCE_NOT_VERIFIED", "A rights-verified OCR question source is required");
  }
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  if (!subject) return apiError(400, "VALIDATION_FAILED", "Unknown subject");
  if (input.answerEvidenceImportItemId) {
    const evidence = await prisma.sourceImportItem.findUnique({
      where: { id: input.answerEvidenceImportItemId }, include: { sourceDocument: true },
    });
    if (!evidence || evidence.recordType !== "ANSWER_PAGE" || evidence.sourceDocument.examYear !== sourceItem.sourceDocument.examYear) {
      return apiError(422, "ANSWER_EVIDENCE_INVALID", "An official answer page from the same exam year is required");
    }
  }
  try {
    const draft = await prisma.sourceQuestionDraft.create({
      data: {
        sourceImportItemId: input.sourceImportItemId, subjectId: input.subjectId,
        sourceQuestionNo: input.sourceQuestionNo, stem: input.stem,
        option1: input.options[0], option2: input.options[1], option3: input.options[2],
        option4: input.options[3], option5: input.options[4], proposedAnswer: input.proposedAnswer,
        answerEvidenceImportItemId: input.answerEvidenceImportItemId, difficulty: input.difficulty,
        explanation: input.explanation, examReferenceDate: input.examReferenceDate,
        reviewStatus: "IN_REVIEW", reviewedBy: principal.userId, reviewedAt: new Date(),
      },
    });
    return NextResponse.json({ draftId: safeId(draft.id), reviewStatus: draft.reviewStatus }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return apiError(409, "DRAFT_ALREADY_EXISTS", "This source question already has a review draft");
    }
    throw error;
  }
}