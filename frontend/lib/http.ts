import { NextResponse } from "next/server";

export function apiError(status: number, code: string, message: string) {
  return NextResponse.json(
    { code, message, traceId: crypto.randomUUID(), fieldErrors: [] },
    { status },
  );
}

export function safeId(value: bigint): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id)) {
    throw new RangeError("Database ID exceeds JSON safe integer range");
  }
  return id;
}

export function parseId(value: string): bigint | null {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
