import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth";
import { AttemptError, submitAttempt } from "@/lib/attempts";
import { apiError, parseId } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userExamId: string }> },
) {
  const principal = await authenticate(request);
  if (!principal) {
    return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  }
  const userExamId = parseId((await params).userExamId);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!userExamId || !idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 100) {
    return apiError(400, "VALIDATION_FAILED", "A valid userExamId and Idempotency-Key are required");
  }

  try {
    return NextResponse.json(await submitAttempt(userExamId, principal.userId, idempotencyKey));
  } catch (error) {
    if (error instanceof AttemptError) {
      return apiError(error.status, error.code, error.message);
    }
    throw error;
  }
}