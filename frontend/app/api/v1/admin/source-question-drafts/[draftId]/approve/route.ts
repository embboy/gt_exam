import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth";
import { apiError, parseId, safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

function normalizedHash(stem: string, options: string[]) {
  const value = [stem, ...options].join("\n").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const principal = await authenticate(request);
  if (!principal) return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  if (principal.role !== "ADMIN") return apiError(403, "FORBIDDEN", "Administrator access is required");
  const draftId = parseId((await params).draftId);
  if (!draftId) return apiError(400, "VALIDATION_FAILED", "draftId must be a positive integer");

  try {
    const question = await prisma.$transaction(async (tx) => {
      const draft = await tx.sourceQuestionDraft.findUnique({
        where: { id: draftId },
        include: { sourceImportItem: { include: { sourceDocument: true } }, answerEvidenceImportItem: { include: { sourceDocument: true } } },
      });
      if (!draft) throw new ReviewError(404, "DRAFT_NOT_FOUND", "Question review draft not found");
      if (draft.reviewStatus !== "IN_REVIEW") throw new ReviewError(409, "DRAFT_NOT_READY", "Only in-review drafts can be approved");
      if (!draft.proposedAnswer || !draft.answerEvidenceImportItem || !draft.explanation.trim()) {
        throw new ReviewError(422, "REVIEW_EVIDENCE_INCOMPLETE", "Answer evidence, answer, and explanation are required");
      }
      if (draft.answerEvidenceImportItem.recordType !== "ANSWER_PAGE"
        || draft.answerEvidenceImportItem.sourceDocument.examYear !== draft.sourceImportItem.sourceDocument.examYear
        || draft.sourceImportItem.sourceDocument.rightsStatus !== "RIGHTS_VERIFIED") {
        throw new ReviewError(422, "REVIEW_EVIDENCE_INVALID", "Verified same-year official answer evidence is required");
      }
      const options = [draft.option1, draft.option2, draft.option3, draft.option4, draft.option5];
      const hash = normalizedHash(draft.stem, options);
      const duplicate = await tx.questionVersion.findUnique({ where: { normalizedHash: hash } });
      if (duplicate) throw new ReviewError(409, "QUESTION_DUPLICATE", "An equivalent question version already exists");

      const created = await tx.question.create({
        data: {
          subjectId: draft.subjectId, topicId: draft.topicId,
          sourceDocumentId: draft.sourceImportItem.sourceDocumentId,
          sourceItemNo: String(draft.sourceQuestionNo), sourceType: "PAST_EXAM",
          status: "APPROVED", createdBy: principal.userId,
        },
      });
      const version = await tx.questionVersion.create({
        data: {
          questionId: created.id, versionNo: 1, difficulty: draft.difficulty, stem: draft.stem,
          option1: draft.option1, option2: draft.option2, option3: draft.option3, option4: draft.option4, option5: draft.option5,
          correctAnswer: draft.proposedAnswer, explanation: draft.explanation,
          examReferenceDate: draft.examReferenceDate, normalizedHash: hash, createdBy: principal.userId,
        },
      });
      await tx.question.update({ where: { id: created.id }, data: { currentVersionId: version.id } });
      await tx.sourceQuestionDraft.update({
        where: { id: draft.id }, data: { reviewStatus: "ACCEPTED", promotedQuestionId: created.id, reviewedBy: principal.userId, reviewedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: principal.userId, actorType: "ADMIN", action: "QUESTION_APPROVED",
          targetType: "question", targetId: created.id.toString(), afterValue: { draftId: draft.id.toString(), questionVersionId: version.id.toString() },
          traceId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
        },
      });
      return created;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ questionId: safeId(question.id), status: question.status });
  } catch (error) {
    if (error instanceof ReviewError) return apiError(error.status, error.code, error.message);
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return apiError(409, "QUESTION_DUPLICATE", "The source question has already been promoted");
    }
    throw error;
  }
}

class ReviewError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}