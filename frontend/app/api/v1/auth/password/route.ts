import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticate } from "@/lib/auth";
import { apiError } from "@/lib/http";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export async function PATCH(request: NextRequest) {
  const principal = await authenticate(request);
  if (!principal) {
    return apiError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }

  const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_FAILED", "New password must be 8 to 128 characters");
  }

  const user = await prisma.appUser.findUnique({ where: { id: principal.userId } });
  if (!user || !await compare(parsed.data.currentPassword, user.passwordHash)) {
    return apiError(401, "AUTHENTICATION_FAILED", "Current password is incorrect");
  }

  await prisma.appUser.update({
    where: { id: principal.userId },
    data: { passwordHash: await hash(parsed.data.newPassword, 12) },
  });

  return NextResponse.json({ message: "Password changed" });
}