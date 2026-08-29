import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAccessToken } from "@/lib/auth";
import { apiError, safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(100),
});

export async function POST(request: NextRequest) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Invalid signup request");
  }

  const existing = await prisma.appUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return apiError(409, "EMAIL_ALREADY_REGISTERED", "Email is already registered");
  }

  const user = await prisma.appUser.create({
    data: {
      email: parsed.data.email,
      passwordHash: await hash(parsed.data.password, 12),
      displayName: parsed.data.displayName,
      role: "USER",
      status: "ACTIVE",
    },
  });
  const accessToken = await createAccessToken({ userId: user.id, role: "USER" });

  return NextResponse.json({
    accessToken,
    tokenType: "Bearer",
    expiresIn: 900,
    user: { userId: safeId(user.id), email: user.email, displayName: user.displayName, role: user.role },
  }, { status: 201 });
}