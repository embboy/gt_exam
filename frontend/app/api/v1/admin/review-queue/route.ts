import { NextRequest, NextResponse } from "next/server";

import { authenticate, canReviewQuestions } from "@/lib/auth";
import { apiError, safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const principal = await authenticate(request);
  if (!principal) return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  if (!canReviewQuestions(principal)) return apiError(403, "FORBIDDEN", "Question reviewer access is required");

  const [sourceItems, subjects, answerItems] = await Promise.all([
    prisma.sourceImportItem.findMany({
      where: { recordType: "OCR_COLUMN", reviewStatus: { in: ["NEEDS_REVIEW", "IN_REVIEW"] } },
      include: {
        sourceDocument: { select: { id: true, examYear: true, title: true, sourceUrl: true, rightsStatus: true } },
        questionDrafts: { orderBy: { sourceQuestionNo: "asc" } },
      },
      orderBy: [{ sourceDocumentId: "asc" }, { pageNo: "asc" }],
      take: 50,
    }),
    prisma.subject.findMany({ orderBy: [{ examStage: "asc" }, { displayOrder: "asc" }] }),
    prisma.sourceImportItem.findMany({
      where: { recordType: "ANSWER_PAGE", sourceDocument: { rightsStatus: "RIGHTS_VERIFIED" } },
      include: { sourceDocument: { select: { examYear: true, title: true } } },
      orderBy: [{ sourceDocumentId: "asc" }, { pageNo: "asc" }],
    }),
  ]);
  return NextResponse.json({
    subjects: subjects.map((subject) => ({ subjectId: safeId(subject.id), code: subject.code, name: subject.name })),
    answerEvidenceItems: answerItems.map((item) => ({
      sourceImportItemId: safeId(item.id), year: item.sourceDocument.examYear,
      title: item.sourceDocument.title, page: item.pageNo, verificationStatus:
        typeof item.payload === "object" && item.payload && "verificationStatus" in item.payload
          ? item.payload.verificationStatus : "NEEDS_REVIEW",
    })),
    sourceItems: sourceItems.map((item) => ({
      sourceImportItemId: safeId(item.id), page: item.pageNo, column: item.pageColumn,
      rawText: item.rawText, reviewStatus: item.reviewStatus,
      source: {
        sourceDocumentId: safeId(item.sourceDocument.id), year: item.sourceDocument.examYear,
        title: item.sourceDocument.title, url: item.sourceDocument.sourceUrl, rightsStatus: item.sourceDocument.rightsStatus,
      },
      drafts: item.questionDrafts.map((draft) => ({
        draftId: safeId(draft.id), questionNo: draft.sourceQuestionNo, subjectId: safeId(draft.subjectId),
        reviewStatus: draft.reviewStatus,
      })),
    })),
  });
}