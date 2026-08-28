import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth";
import { AttemptError, loadAttempt } from "@/lib/attempts";
import { apiError, parseId } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userExamId: string }> },
) {
  const principal = await authenticate(request);
  if (!principal) {
    return apiError(401, "AUTHENTICATION_REQUIRED", "A valid bearer token is required");
  }
  const userExamId = parseId((await params).userExamId);
  if (!userExamId) {
    return apiError(400, "VALIDATION_FAILED", "userExamId must be a positive integer");
  }
  try {
    return NextResponse.json(await loadAttempt(userExamId, principal.userId));
  } catch (error) {
    if (error instanceof AttemptError) {
      return apiError(error.status, error.code, error.message);
    }
    throw error;
  }
}