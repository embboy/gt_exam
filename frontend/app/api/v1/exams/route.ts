import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  stage: z.coerce.number().int().min(1).max(2).optional(),
  kind: z.enum(["PAST_EXAM", "PREDICTED"]).optional(),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    stage: request.nextUrl.searchParams.get("stage") ?? undefined,
    kind: request.nextUrl.searchParams.get("kind") ?? undefined,
  });
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "stage must be 1 or 2 and kind must be PAST_EXAM or PREDICTED");
  }

  const exams = await prisma.mockExam.findMany({
    where: {
      status: "PUBLISHED",
      examStage: parsed.data.stage,
      examKind: parsed.data.kind,
    },
    include: {
      sessions: { orderBy: { sessionNo: "asc" } },
    },
    orderBy: [{ examStage: "asc" }, { setNo: "asc" }],
  });

  return NextResponse.json(exams.map((exam) => ({
    examId: safeId(exam.id),
    kind: exam.examKind,
    stage: exam.examStage,
    setNo: exam.setNo,
    title: exam.title,
    status: exam.status,
    sessions: exam.sessions.map((session) => ({
      sessionNo: session.sessionNo,
      durationMinutes: session.durationMinutes,
    })),
  })));
}
