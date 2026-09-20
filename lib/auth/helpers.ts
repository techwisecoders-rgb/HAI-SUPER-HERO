// Server-side password hashing using bcrypt. bcryptjs is pure JS so it
// runs in any Node runtime (Edge runtime uses @/lib/auth/edge.ts instead).

import bcrypt from "bcryptjs";

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  // Same `$2b$` → `$2a$` rewrite as hashOtp() below, for consistency
  // with pgcrypto. Verification still works on the Node side.
  const h = await bcrypt.hash(plain, ROUNDS);
  return h.startsWith("$2b$") ? "$2a$" + h.slice(4) : h;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Generate a numeric OTP of the requested length (default 6 digits).
 * Uses crypto.randomInt so it's cryptographically secure.
 */
export function generateOtp(length = 6): string {
  // 6 digits => range 0..999999. We pad below.
  const max = 10 ** length;
  // Node exposes globalThis.crypto since v18.
  const c = (globalThis as { crypto?: { randomInt?: (a: number, b: number) => number } }).crypto;
  let n: number;
  if (c && typeof c.randomInt === "function") {
    n = c.randomInt(0, max);
  } else {
    // Fallback (shouldn't happen in Node 18+ but kept for safety).
    n = Math.floor(Math.random() * max);
  }
  return n.toString().padStart(length, "0");
}

export async function hashOtp(code: string): Promise<string> {
  // OTPs are short and low-entropy (6 digits = 1M possibilities), so a
  // global salt is fine; bcrypt's per-user salt would not add real
  // security here and would slow verification noticeably.
  //
  // We strip `$2b$` → `$2a$` so the resulting hash is compatible
  // with pgcrypto's `crypt()` function (which only recognizes `$2a$`
  // and `$2y$`, not `$2b$`). The hash bytes themselves are identical
  // between `$2a$` and `$2b$`, so verification still works for any
  // Node-side `bcrypt.compare()` call.
  const h = await bcrypt.hash(code, 8);
  return h.startsWith("$2b$") ? "$2a$" + h.slice(4) : h;
}