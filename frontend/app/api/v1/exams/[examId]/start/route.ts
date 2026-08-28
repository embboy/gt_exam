import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticate } from "@/lib/auth";
import { AttemptError, startAttempt } from "@/lib/attempts";
import { apiError, parseId } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> },
) {
  const principal = await authenticate(request);
  if (!principal) {
    return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  }
  const examId = parseId((await params).examId);
  const requestId = request.headers.get("x-request-id");
  if (!examId || !z.uuid().safeParse(requestId).success) {
    return apiError(400, "VALIDATION_FAILED", "A valid examId and X-Request-Id are required");
  }

  try {
    const result = await startAttempt(examId, principal.userId, requestId!);
    return NextResponse.json(result.attempt, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof AttemptError) {
      return apiError(error.status, error.code, error.message);
    }
    throw error;
  }
}