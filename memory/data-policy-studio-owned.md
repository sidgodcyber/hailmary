# Data policy: studio-owned, admin-only export (reversed from original brief)

The original build brief framed data as client-owned with an advertised one-click export as
the core trust mechanism. The user **reversed this** mid-build: the session data is primarily
the studio's asset (raw material for the intelligence built on top of it).

What this means in the code:
- **No client-facing export** and **no "your data is yours" copy** anywhere a client sees.
  `/app/settings` has an honest "About your data" note (studio-managed, exports on request).
- **Admin-only export**: `GET /api/admin/export/[tenant]` (admin session required, client →
  403) produces a zip (JSON + Markdown + CSVs). Surfaced on the admin tenant page.
- `DATA.md` is written honestly for that policy — safe to show a client, makes no false
  ownership promise.
- The Gravity read API (portal → studio's system) is unchanged and is more central under this
  framing.

Judgment note for future edits: keep anything client-facing **truthful** about this policy.
Don't reintroduce "your data is yours" language. If the user later wants client self-export,
it's a small addition (reuse `src/lib/export.ts`).
