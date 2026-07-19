/**
 * Safe server logging. We NEVER log client content (idea/task/calendar bodies,
 * comments, briefs). Only event names + ids + error messages. Keep it that way.
 */
type Meta = Record<string, string | number | boolean | null | undefined>;

export function logInfo(event: string, meta: Meta = {}) {
  console.log(`[hailmary] ${event}`, redact(meta));
}

export function logError(event: string, meta: Meta = {}) {
  console.error(`[hailmary] ${event}`, redact(meta));
}

// Defensive: drop anything that looks like free text content.
const BLOCKED = new Set(["body", "title", "details", "summary", "caption", "notes"]);
function redact(meta: Meta): Meta {
  const out: Meta = {};
  for (const [k, v] of Object.entries(meta)) {
    out[k] = BLOCKED.has(k) ? "[redacted]" : v;
  }
  return out;
}
