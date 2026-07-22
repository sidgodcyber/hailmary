# Hailmary

A mobile-first **client companion portal** for a freelance social-media studio. It's a
CRM from the studio's side and a collaboration space from the client's side: clients sign
in with a magic link to post ideas and reference briefs, brainstorm in threads, create
tasks, and co-manage a shared content calendar. Every action is written to a per-tenant
activity feed, which doubles as the one-way read surface a separate personal system
("Gravity") can later ingest.

Multi-tenant from day one, isolation enforced in the database (Postgres RLS), passwordless
auth, and designed to run at **$0/month on free tiers**.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| App + API | **Next.js 15 (App Router) on Vercel** | One framework for UI, server actions and route handlers; first-class free hosting. |
| DB + Auth + Storage | **Supabase** (Postgres, RLS, magic-link auth) | Isolation at the DB layer; passwordless auth built in; free tier. |
| Schema / policies | **Plain SQL migrations** (`supabase/migrations`) | RLS is the security-critical surface — keep it as readable SQL, no ORM. |
| Typed DB access | `@supabase/supabase-js` + `@supabase/ssr` | Cookie sessions in the App Router; anon key on the client, service role server-only. |
| UI | **Tailwind CSS** (warm teal/amber theme) | Fast, mobile-first, no external fonts/CDNs. |
| Tests | **Vitest + PGlite** | Real Postgres **in-process, no Docker** — the adversarial RLS tests run the actual migration SQL. |
| Export bundle | **jszip** | Admin-only data export (JSON + Markdown + CSVs). |

## Repository layout

```
supabase/migrations/   0001 schema · 0002 RLS helpers+policies · 0003 rate-limit fn
scripts/seed.ts        creates Shunyethra tenant, admin + client users, demo content
src/lib/               supabase clients (server/browser/admin), auth, activity, export, config
src/app/               login, auth/callback, app/* (client portal), admin/*, api/*
src/components/         mobile-first UI (warm theme)
tests/                 isolation.test.ts (adversarial RLS) · export-api.test.ts · setup/db.ts (PGlite)
middleware.ts          session refresh + route protection
DATA.md                plain-language data policy (client-showable)
```

## Roles & tenancy

- Two roles in **`profiles.global_role`** (also mirrored into `auth.users.app_metadata.role`
  by the seed/invite flow): **`admin`** (the studio — sees and edits across all tenants) and
  **`client`** (sees only their own tenant). Request-time checks read `profiles.global_role`.
- Every domain row carries `tenant_id`. RLS policies allow a row only when
  `is_admin() OR is_member_of(tenant_id)`. Adding a new client (e.g. Roven) is a **data
  operation** (create tenant + invite) — never a code change.

---

## Local development

**Prerequisites:** Node 18.18+, and a free Supabase project (for a runnable app with real
auth). The test suite needs neither Docker nor a Supabase project.

1. **Install**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at <https://supabase.com> (free tier). Then copy env:

   ```bash
   cp .env.example .env.local
   ```

   Fill in from *Project Settings → API*:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
   - `NEXT_PUBLIC_SITE_URL` = `http://localhost:3000`
   - `GRAVITY_EXPORT_TOKEN` — generate one with `npm run gen:token`
   - `ADMIN_EMAIL`, `SHUNYETHRA_CLIENT_EMAIL`

3. **Apply the schema.** Either paste the three files in `supabase/migrations/` (in order)
   into the Supabase **SQL editor**, or link the CLI and push:

   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```

4. **Seed** the Shunyethra tenant, your admin login, the client login, and demo content:

   ```bash
   npm run seed
   ```

5. **Run**

   ```bash
   npm run dev        # http://localhost:3000
   ```

   Go to `/login`, enter `ADMIN_EMAIL` or `SHUNYETHRA_CLIENT_EMAIL`, and open the magic link.
   > Magic-link emails require SMTP configured in Supabase (*Auth → Email*). Until then, use
   > the admin **Invite** flow, which generates a copyable magic link you can open directly.

## Testing

```bash
npm run test              # all tests
npm run test:isolation    # adversarial cross-tenant RLS tests only
```

Tests use **PGlite** (WASM Postgres in Node) — no Docker, no cloud project. The harness
applies the real migration SQL, shims the few things hosted Supabase provides (`auth.uid()`,
the `authenticated`/`anon`/`service_role` roles), then impersonates users via
`request.jwt.claims` exactly as PostgREST does. Coverage:

- **`isolation.test.ts`** — a logged-in client of tenant A cannot read tenant B (0 rows),
  cannot insert into B (RLS rejects), cannot update/delete B (0 rows affected); admin spans
  both tenants; a session with no membership sees nothing.
- **`export-api.test.ts`** — constant-time bearer check (missing/wrong/right token), the
  Postgres fixed-window rate limiter, and tenant-scoped activity reads with the `since` filter.

## Deploy (Vercel + Supabase, free tiers)

1. Push this repo to GitHub and import it into **Vercel**.
2. Set the same env vars in Vercel Project Settings (set `NEXT_PUBLIC_SITE_URL` to the
   deployed URL, e.g. `https://hailmary.vercel.app`).
3. In Supabase **Auth → URL Configuration**, add the deployed URL and
   `<url>/auth/callback` to the allowed redirect URLs.
4. Apply migrations to the Supabase project (SQL editor or `supabase db push`), then run
   `npm run seed` locally against the same project (it uses the service role key).
5. Deploy. Configure SMTP in Supabase for real magic-link emails, or use the admin invite
   link flow.

---

## The Gravity read API (the one-way door out)

A single authenticated, read-only endpoint. Nothing about the consumer lives in this repo.

```
GET /api/export/activity?tenant=<uuid>&since=<ISO8601>
Authorization: Bearer <GRAVITY_EXPORT_TOKEN>
```

- **Auth:** one long random bearer token in `GRAVITY_EXPORT_TOKEN` (server-only; never shipped
  to any client). Missing/wrong token → `401`.
- **Params:** `tenant` (required) scopes the result; `since` (optional ISO timestamp) returns
  only rows created **after** it, oldest-first — for incremental ingestion.
- **Rate limit:** 60 requests / 60s per tenant (Postgres fixed-window counter, so it holds
  across serverless instances). Over budget → `429`.
- **Response:**

  ```json
  {
    "tenant": "<uuid>",
    "since": "2026-07-01T00:00:00Z",
    "count": 2,
    "activity": [
      {
        "id": "<uuid>",
        "tenant_id": "<uuid>",
        "actor_id": "<uuid|null>",
        "verb": "reference.created",
        "object_type": "reference",
        "object_id": "<uuid>",
        "summary": "added a reference brief “Fast-cut unboxing hook”",
        "payload": { "...": "full record for this event" },
        "created_at": "2026-07-02T09:12:00Z"
      }
    ]
  }
  ```

**Why one admin token, not per-tenant:** the only consumer is Gravity, which the studio
controls, and the endpoint already scopes by `tenant` and is read-only — per-tenant token
rotation would be pure overhead in v1. If that changes, add a `tenant_tokens` table and check
the bearer against it; the route is the only place to touch.

## Admin-only data export

There is **no client-facing export**. From **Admin → a client → Export**, the admin downloads
that client's full workspace as a zip (`data.json`, `summary.md`, and per-table CSVs) via
`GET /api/admin/export/<tenant>`. The route requires an admin session; a client gets `403`.
See `DATA.md` for the plain-language policy.

## Magic-link sign-in: two flows, and why both exist

There are **two** ways a sign-in link can resolve, and they are not interchangeable:

| Flow | Route | Carries | Works when |
|---|---|---|---|
| **PKCE** | `/auth/callback` | `?code=` | Link is opened in the **same browser** that requested it (the in-app `/login` form). Needs a `code_verifier` cookie. |
| **Implicit** | `/login` (client-side) | `#access_token=` in the URL fragment | Links minted by `auth.admin.generateLink` (the admin **Invite** flow). A server route can never read a fragment. |
| **Token hash** | `/auth/confirm` | `?token_hash=` | **Any** browser or device. No cookie required. |

**Emailed links must use the token-hash flow.** Clients open email on a phone, usually in
Gmail's in-app browser — a different browser context from the one that requested the link, so
the PKCE `code_verifier` cookie is absent and the exchange fails. The symptom is a sign-in
**loop**: the link appears to do nothing and bounces back to `/login`.

To fix it, set the Supabase **Magic Link** email template
(*Authentication → Emails → Magic Link*) to point at `/auth/confirm`:

```html
<h2>Your sign-in link</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/">Sign in</a></p>
```

Also add `https://<your-app>/**` (with the `/**` wildcard) to *Authentication → URL
Configuration → Redirect URLs*, and set **Site URL** to the deployed origin. Without the
wildcard Supabase silently drops the path and sends users to `/` instead of the auth handler —
`middleware.ts` now rescues that case by forwarding stray `?code=` / `?token_hash=` to the
right route, but the allowlist should still be correct.

## Deploying: commit author must own the Vercel project

On the Vercel **Hobby** plan a private repo has no collaborators, so a deployment whose
**commit author** resolves to a different GitHub user is rejected with *"Deployment was
blocked … the commit author did not have contributing access"*. Commit as the account that
owns the Vercel project:

```bash
git config --local user.name  "<github-username>"
git config --local user.email "<id>+<github-username>@users.noreply.github.com"   # gh api user --jq .id
```

## Delivering magic links over WhatsApp (future)

Clients live on WhatsApp. The admin **Invite** flow already calls Supabase's
`auth.admin.generateLink({ type: 'magiclink' })` and returns the link for you to copy — today
you can paste it into WhatsApp by hand. To automate later, POST that `action_link` to a
WhatsApp Business API / provider instead of relying on email. No architecture change needed.

## Security notes

- Tenant isolation is enforced by Postgres RLS and covered by adversarial tests (above).
- Magic-link tokens are single-use and expiring (Supabase Auth).
- The service role key and `GRAVITY_EXPORT_TOKEN` are server-only env vars, never in client code.
- Logs record event names + ids only — never idea/task/calendar/comment bodies (`src/lib/log.ts`).

### `npm audit`

`npm audit fix --force` would try to **downgrade Next.js to v9 — do not run it.** The two
production findings are a transitive, build-time `postcss` advisory bundled inside Next
(CSS stringify XSS — not reachable at runtime here); the rest are in dev/test tooling. Clear
them by upgrading Next when a release bumps its bundled `postcss`, not by force-fixing.
