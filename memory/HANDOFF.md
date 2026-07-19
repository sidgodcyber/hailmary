# Hailmary — Handoff snapshot

_Last refreshed: 2026-07-15._

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
