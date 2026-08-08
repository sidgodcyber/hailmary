# Hailmary — Handoff snapshot

_Last refreshed: 2026-08-09 (v1.5 session 3: item 4 draft approval + media)._

## ⚠️ ACTION REQUIRED BEFORE ITEM 4 WORKS LIVE
Item 4 is **built, typechecked, tested (32 pass) and building clean — but not yet applied to the
live DB.** Probed just now: `/rest/v1/assets` → 200, `/rest/v1/attachments` → **404**, bucket list
→ **empty**. Paste these into the Supabase **SQL Editor**, in order:
1. `supabase/migrations/0005_attachments.sql` — attachments table + RLS + `storage_tenant_id()` +
   the calendar status CHECK swap + `approved_by/approved_at`.
2. `supabase/migrations/0006_storage.sql` — private `media` bucket (20 MB) + `storage.objects`
   policies. If it errors with *"must be owner of table objects"*, create the four policies via
   Dashboard → Storage → Policies using the same expressions (they're in the file).

Then say so and I'll re-probe + run a real insert/constraint check, as with 0004.

## v1.5 SESSION 3 — item 4: DRAFT APPROVAL + MEDIA ON CALENDAR (code complete, DB pending)
- **Storage model.** Private `media` bucket, path `{tenant_id}/{parent_type}/{parent_id}/{uuid}-{name}`.
  `storage.objects` RLS keys off the FIRST path segment via `public.storage_tenant_id(name)`, which
  returns NULL (fails closed) on a non-uuid segment rather than throwing inside a policy.
- **Uploads go browser → Storage directly, NOT through a server action** — Vercel caps a serverless
  request body at 4.5 MB, so a 20 MB video could never survive a server-action round trip. That
  makes storage RLS the real gatekeeper, not a convenience.
- **Three independent layers stop cross-tenant media** (verified, see below):
  1. `attachments_path_tenant_scoped` CHECK — a row's `storage_path` must start with its own
     `tenant_id || '/'`. Without this, a member of A could file a row *in their own tenant*
     pointing at B's object and have the app sign it for them. This was the real hole.
  2. Server action re-derives the tenant from the session (never the form) and re-validates the path.
  3. Signing uses the **RLS-bound** client, so storage RLS refuses to sign a foreign path.
- **`public.attachments`** (polymorphic: `idea` | `calendar`; kinds `image` | `video` | `drive`),
  plus CHECKs for the 20 MB size cap and the stored-media-XOR-link shape.
- **Approval loop**: `idea → drafted → awaiting_approval → approved → posted`, plus
  `changes_requested`. `approved`/`changes_requested`/`awaiting_approval` are **unreachable from the
  status dropdown** — server-side too, not just UI — so "Approved" always means someone pressed
  approve. `approved_by`/`approved_at` record who actually did.
- **Deviation from the plan, flagged:** the plan said approve/request-changes are *client-only*. As
  written, an admin **can** press them, but it is stored and displayed as *"recorded by the studio on
  the client's behalf"* (distinct activity verb + `onBehalf` payload + a line in the approved panel).
  Reason: real approvals arrive over WhatsApp, and a strictly client-only button would have pushed
  the studio to fake it with "Posted". Say the word and it becomes a hard block.
- Client dashboard leads with "N drafts need your approval"; admin dashboard has a cross-tenant
  "In the approval loop" list. Admin tenant detail shows media storage used vs the ~1 GB budget.
- Images are compressed client-side (canvas → 1600px, jpeg q0.8) before upload; video is a Drive
  link first-class, with direct upload allowed only under 20 MB. Orphaned objects (upload succeeded,
  row insert failed) are cleaned up by the uploader's error path.
- **Also fixed en route (pre-existing, from item 3):** `AssetItem` rendered a stored `drive_url`
  straight into `href` — a `javascript:` URL there was stored XSS. All external links now go through
  `safeExternalUrl()` (http/https only). Exports now include `assets` + `attachments` too.

### Tests — 32 pass (was 20)
`tests/isolation.test.ts` adds cross-tenant cases for attachments: filing a row into another tenant
(RLS), claiming a path in another tenant's folder (CHECK), re-pointing an existing row at a foreign
folder (CHECK), update/delete of a foreign attachment (0 rows), forged oversize/malformed rows, and
the storage predicate itself — `is_member_of(storage_tenant_id(path))` — evaluated against real
paths for client/admin/stranger.

**Verified these tests aren't vacuous.** A probe printed which layer rejects what:
| attempt (as tenant A's client) | rejected by |
|---|---|
| path in B's folder, row filed under A | `attachments_path_tenant_scoped` CHECK |
| row filed under B directly | row-level security policy |
| prefix confusion `{A}{B}/…` | `attachments_path_tenant_scoped` CHECK |
| legit path in A's own folder | allowed (as intended) |

**PGlite has no `storage` schema**, so `0006` is deliberately NOT loaded by `tests/setup/db.ts`.
`storage_tenant_id()` was put in `0005` precisely so the expression the bucket policies are built on
is still covered by tests. The bucket policies themselves still need a **live signed-URL round-trip**
to be considered verified — not done yet (see below).

### Still unverified for item 4
- Bucket policies live (needs 0005+0006 applied, then: upload as the client, confirm a signed URL
  works, and confirm a path under another tenant refuses to sign).
- Any real click-through — no upload has been made against the live app yet.

## v1.5 SESSION 2 — shipped & verified live
- **Google sign-in (self-serve auth)** — the real fix for the sign-in saga. `/login` has a
  "Continue with Google" button; both admin + client are on Gmail. OAuth goes through PKCE at
  `/auth/callback` (server-side code exchange → deterministic cookies). Browser client reverted
  to PKCE default (the earlier `flowType: implicit` raced detectSessionInUrl and stranded users
  on /login). Google linked to the existing admin account (providers `[email,google]`, same id,
  admin role preserved). Google Cloud OAuth client + Supabase Google provider are configured by
  the user. Email magic-link form kept as secondary; admin WhatsApp-invite links still work.
  **Root cause of the whole email saga: Gmail prefetches single-use links and burns the token**
  — see `[[magic-link-flows]]`. Google sidesteps email entirely.
- **Region cutover DONE**: new Supabase project `kxsjwfzceiteqzbjizjv` in `ap-south-1` (Mumbai),
  migrations applied, seeded (tasks=2, all correct). Vercel functions in `bom1`
  (`X-Vercel-Id: bom1::bom1`). Old Seoul + stray projects deleted. Everything co-located in
  Mumbai. `.env.local` + Vercel env updated.
- **v1.5 item 3 — raw asset (footage) tracker — LIVE & verified.** `public.assets` table
  (migration `0004_assets.sql`, applied), tenant-scoped RLS, adversarial tests added (**20 tests
  pass**). `/app/assets` grouped by status; new "Assets" bottom-nav tab; Drive link + label,
  one-tap status chain new→downloaded→editing→edited→used, note + link-to-calendar; attributed
  activity. Verified with a real insert/constraint/delete on the live DB.

## v1.5 REMAINING — item 5 only (plan approved; migrations now go up to `0006`)
- **Item 5 — voicenotes + Groq AI summaries.** Needs `GROQ_API_KEY` (user will create). Playback
  must never depend on AI (fail soft). Verify Groq model names against live docs.
  Reuses item 4's storage plumbing: same `media` bucket under
  `{tenant_id}/voicenotes/{ideaId}/…`, so the existing `storage.objects` policies already cover it
  — the new migration only needs the `voicenotes` table + RLS. Sign playback URLs with
  `signMediaUrls()` from `src/lib/media.ts`, and keep the same three-layer path discipline (add a
  path-scoping CHECK on the voicenotes table too — that's what caught the real hole in item 4).

## Migration application (recurring ops)
DDL can't run via the service-role/PostgREST key — the USER pastes each new `supabase/migrations/
*.sql` into the Supabase **SQL Editor** and runs it. Claude verifies afterward via a REST probe
(`/rest/v1/<table>` → 200) + a real insert/constraint check.

---
_Below: v1.5 session 1 snapshot._

## v1.5 SESSION 1 — what shipped (deployed & live)
- **Self-serve export**: `GET /api/export/data` uses the **RLS-bound** client scoped to the
  caller's own tenant (a client can only ever export their own workspace). Logs a
  `data.exported` activity event. Settings has a working "Export my data" button; Settings copy
  + `DATA.md` rewritten to "your data is yours" — **this deliberately re-reverses the earlier
  studio-owned policy**; see `[[data-policy-studio-owned]]` (now superseded).
- **Speed**: `getAuthContext` cut 3 sequential round-trips → 2 (profile ‖ tenants in parallel;
  the RLS-scoped `tenants` select serves both roles, so the isAdmin branch + memberships join
  are gone). Idea/calendar detail and admin tenant detail batched into single `Promise.all`s.
  `loading.tsx` skeletons on every data route via `PageSkeleton` in `components/ui.tsx`.
- **Magic-link sign-in loop FIXED** (was blocking the real client) — see
  `[[magic-link-flows]]`. Added `/auth/confirm` (token_hash + `verifyOtp`, works from any
  browser/device) and a middleware rescue for links landing on the wrong path.

## Measured speed (deployed, warm TTFB)
| Path | Before | After |
|---|---|---|
| `/` redirect | 0.53–0.82s | 0.36–0.37s |
| `/api/export/activity` (no DB) | 0.44s | 0.35s |
| `/login` | 0.17–0.21s | 0.13s |

**Residual latency is NOT code-fixable — it's geography.** `X-Vercel-Id: bom1::iad1` proves
requests hit the Mumbai edge but execute in **iad1 (US-East)**, then talk to Supabase in
**Seoul**. A no-DB function still costs ~0.35s. Two ops fixes remain (below). Vercel cold start
(~1.0s first hit) is inherent to the free tier.

## INFRA CUTOVER — DONE & VERIFIED (2026-07-22)
- **Supabase migrated Seoul → Mumbai.** New project ref **`kxsjwfzceiteqzbjizjv`**
  (`ap-south-1`). Old Seoul project (`tyqmmerftoogpovbpkve`) **deleted**. Migrations applied,
  `npm run seed` run, all row counts correct (tenants 1, profiles 2, memberships 1, ideas 2,
  comments 2, tasks 2, calendar 3, activity 4).
- **Vercel functions moved to Mumbai** via dashboard (Settings → Functions). Verified:
  `X-Vercel-Id: bom1::bom1` (was `bom1::iad1`). Compute + DB now co-located next to users.
- **End-to-end proof**: deployed Gravity API returned live data from the Mumbai DB
  (`GET /api/export/activity` → `count: 4`).
- **Email sign-in fixed in code, not config.** Supabase locks email-template editing behind
  custom SMTP (unavailable — Brevo suspended the account), so `/auth/confirm` can't be reached
  by email. Instead the browser client now uses `flowType: "implicit"`, so emailed links carry
  the session in the URL fragment and `/login` handles them client-side — works on any device.
  See `[[magic-link-flows]]`. `/auth/confirm` + `/auth/callback` remain for later/admin links.

**Still unverified by me:** authed-page timings and the client's emailed-link login — my
sandbox isn't in India, so those need a human click-through to confirm.

## Email deliverability (known constraint)
Custom SMTP is OFF; using Supabase's built-in mailer, which is rate-limited (~3-4/hour) and
fine for a pilot but not for scale. **Brevo is dead** (account permanently suspended, so it
can't be re-enabled). A different provider is needed before real volume — and enabling any
custom SMTP also unlocks email-template editing, at which point switching to the stricter
token-hash flow (`/auth/confirm`) becomes possible.

## Vercel deploy gotcha (cost ~2 blocked deploys)
Hobby + private repo = no collaborators, so a deployment whose **commit author** resolves to a
different GitHub user is rejected: *"Deployment was blocked … commit author did not have
contributing access"*. Commits were authored `siddhibaluja06@gmail.com` (→ GitHub `sidgodcyber`)
but the project belongs to `work0909-debug`. Fixed by setting a repo-local identity:
`git config --local user.email "305450507+work0909-debug@users.noreply.github.com"`.
Also: git was authenticating as the wrong gh account — this repo now has
`credential.https://github.com.helper = !gh auth git-credential` set locally.

## NOT started — v1.5 items 3-5 (fresh session; plan is approved)
Raw asset tracker, draft-approval + media on calendar (storage bucket + RLS), voicenotes +
Groq AI summaries. Full spec in the approved plan file
(`~/.claude/plans/hailmary-build-drifting-narwhal.md`, "Hailmary v1.5" section). Groq key: the
user said they'd create one; not yet added to env.

---
_Below: original v1 snapshot._

## One line
A multi-tenant, mobile-first client companion portal (Next.js 15 + Supabase) with magic-link
auth, DB-enforced tenant isolation, ideas/reference-briefs/tasks/calendar/activity, an
admin-only data export, and a one-way read API for the "Gravity" system — fully built and
verified at the code level (18 tests + production build pass).

## What exists and is verified
- **Migrations** (`supabase/migrations/`): schema, RLS helpers (`is_admin()`,
  `is_member_of()`) + policies on every table, and a Postgres rate-limit function.
- **Auth**: magic-link login (`/login`), PKCE callback (`/auth/callback`), `middleware.ts`
  session refresh + route protection, role/tenant resolution (`src/lib/auth.ts`).
- **Client portal** (`/app/*`): dashboard, ideas board + reference briefs (structured fields,
  editable brief, send-to-calendar), tasks, month-view calendar with attribution, activity
  feed, settings (honest data note, **no export button**).
- **Admin** (`/admin/*`): tenant list + create, tenant detail (members, stats, invite,
  export), cross-tenant recent activity, tenant switcher, "open workspace".
- **APIs**: `GET /api/export/activity` (Gravity, bearer + rate limit, read-only);
  `GET /api/admin/export/[tenant]` (admin-only zip export).
- **Seed** (`scripts/seed.ts`): env-driven; creates Shunyethra, admin+client users, demo data.
- **Tests** (Vitest + PGlite, no Docker): `npm run test` → **18 passing**
  (10 adversarial isolation + 8 export/rate-limit). Production `next build` passes.

## Confirmed decisions
- App name **Hailmary**; warm teal/amber theme.
- Admin and Shunyethra client logins are set via env (`ADMIN_EMAIL`, `SHUNYETHRA_CLIENT_EMAIL`
  in `.env.local`, which is gitignored). The confirmed real addresses were provided during
  setup and are kept out of the repo on purpose (a client's email should not be committed).
- **Data policy reversed from the original brief**: session data is the studio's asset. No
  client-facing export, no "your data is yours" promise. Admin can export on request. See
  `DATA.md` and `[[data-policy-studio-owned]]`.
- One admin bearer token for the Gravity API (not per-tenant) — justified in README.
- Testing via PGlite instead of Docker/`supabase start` — see `[[rls-testing-with-pglite]]`.

## Live status (2026-07-15) — CONNECTED & VERIFIED
- Supabase project connected (`.env.local` filled). All 3 migrations applied via SQL editor;
  all 9 tables + `check_rate_limit` RPC confirmed present.
- `npm run seed` ran successfully: Shunyethra tenant, admin + client users, demo content
  (1 tenant, 2 profiles, 1 membership, 2 ideas incl. reference brief, 2 comments, 2 tasks,
  3 calendar entries, 4 activity rows).
- Admin signed in via magic link; every route returned 200 against live data:
  `/admin`, `/admin/tenants/[id]`, `/app`, `/app/{ideas,tasks,calendar,activity,settings}`.

## Two bugs found & fixed during live bring-up
- **Seed batch insert** (`scripts/seed.ts`): the two-task batch had mismatched object keys
  (one had `details`, one didn't) → PostgREST `PGRST102` rejected the whole batch, and no
  insert checked its error, so it silently "succeeded" with 0 tasks. Fixed: matched keys +
  added `throw` on every insert error. (Live DB was patched directly with the 2 tasks.)
- **Admin magic links** used the implicit (hash-token) flow but pointed at the PKCE-only
  `/auth/callback` route → dead link. Fixed: `/login` now catches fragment tokens client-side;
  invite `redirectTo` → `/login`. See `[[supabase-admin-links-implicit-flow]]`.

## Still needs the user
- **Add Redirect URLs in Supabase** (Auth → URL Configuration): `http://localhost:3000/**`
  and the deployed `https://<app>.vercel.app/**`. Needed so `redirect_to` is honored and real
  SMTP email links work.
- **SMTP** for magic-link emails is not configured — until then use the admin Invite flow (or
  `auth.admin.generateLink`) to mint sign-in links. Client login works via an invite link.
- Re-run `npm run build` before deploying (login/admin edits since the last full build; tsc is
  clean).

## Exact next steps for the user
1. Create a free Supabase project; copy `.env.example` → `.env.local` and fill values.
2. `npm run gen:token` → put the result in `GRAVITY_EXPORT_TOKEN`.
3. Apply `supabase/migrations/*` (SQL editor or `npx supabase db push`).
4. `npm run seed`, then `npm run dev`, and sign in at `/login`.
5. Deploy to Vercel; mirror env vars; add the deployed URL + `/auth/callback` to Supabase Auth
   redirect URLs.

## Gotchas / notes
- Do **not** run `npm audit fix --force` (would downgrade Next to v9). See README audit note.
- RLS helper functions are `SECURITY DEFINER` to avoid policy recursion — keep them that way.
- Admin queries bypass RLS via `is_admin()`, so app code must always filter by the active
  tenant explicitly (it does).
