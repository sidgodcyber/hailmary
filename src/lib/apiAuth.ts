import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time bearer check for the Gravity read API. Returns true only when
 * the Authorization header carries exactly the configured token.
 */
export function bearerOk(authHeader: string | null, token: string | undefined): boolean {
  if (!token) return false;
  const prefix = "Bearer ";
  if (!authHeader || !authHeader.startsWith(prefix)) return false;
  const provided = authHeader.slice(prefix.length);
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
