import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth";
import { composeAndPublish, PublishError } from "@/lib/exam-publish";
import { apiError, parseId } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ examId: string }> }) {
  const principal = await authenticate(request);
  if (!principal) return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  if (principal.role !== "ADMIN") return apiError(403, "FORBIDDEN", "Administrator access is required");
  const examId = parseId((await params).examId);
  if (!examId) return apiError(400, "VALIDATION_FAILED", "examId must be a positive integer");
  try {
    return NextResponse.json(await composeAndPublish(examId, principal.userId, request.headers.get("x-request-id") ?? crypto.randomUUID()));
  } catch (error) {
    if (error instanceof PublishError) return apiError(error.status, error.code, error.message);
    throw error;
  }
}