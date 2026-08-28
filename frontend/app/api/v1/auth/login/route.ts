import { compare } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createAccessToken, type AuthPrincipal } from "@/lib/auth";
import { apiError, safeId } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "Invalid login request");
  }

  const user = await prisma.appUser.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.status !== "ACTIVE" || !await compare(parsed.data.password, user.passwordHash)) {
    return apiError(401, "AUTHENTICATION_FAILED", "Invalid email or password");
  }

  const role = user.role as AuthPrincipal["role"];
  const accessToken = await createAccessToken({ userId: user.id, role });
  return NextResponse.json({
    accessToken,
    tokenType: "Bearer",
    expiresIn: 900,
    user: { userId: safeId(user.id), email: user.email, displayName: user.displayName, role },
  });
}