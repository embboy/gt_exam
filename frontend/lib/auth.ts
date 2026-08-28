import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const issuer = "gt-exam";
const audience = "gt-exam-api";

export type AuthPrincipal = {
  userId: bigint;
  role: "USER" | "QUESTION_REVIEWER" | "ADMIN" | "AI_AGENT";
};

export function canReviewQuestions(principal: AuthPrincipal) {
  return principal.role === "QUESTION_REVIEWER" || principal.role === "ADMIN";
}

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 bytes");
  }
  return new TextEncoder().encode(secret);
}

export async function createAccessToken(principal: AuthPrincipal) {
  return new SignJWT({ role: principal.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(principal.userId.toString())
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey());
}

export async function authenticate(request: NextRequest): Promise<AuthPrincipal | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(authorization.slice(7), secretKey(), {
      issuer,
      audience,
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.role !== "string") {
      return null;
    }
    if (!["USER", "QUESTION_REVIEWER", "ADMIN", "AI_AGENT"].includes(payload.role)) {
      return null;
    }
    return {
      userId: BigInt(payload.sub),
      role: payload.role as AuthPrincipal["role"],
    };
  } catch {
    return null;
  }
}