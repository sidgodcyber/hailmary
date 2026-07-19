# Your data in Hailmary

_Plain-language summary of what this workspace stores and how it's handled. Written to be
honest if shown to a client._

## What Hailmary is

Hailmary is the shared workspace your studio runs for our collaboration. It holds the things
we work on together:

- **Ideas & reference briefs** — thoughts you post, reels/posts you share as references, and
  the briefs we shape from them (concept, hook, outline, caption direction).
- **Tasks** — things to do, assigned to the studio or to you, with due dates.
- **Content calendar** — planned posts with dates, channels and status.
- **Comments** — the discussion threads on ideas and calendar entries.
- **Activity** — a timestamped log of the above, so nothing gets lost.

## Where it's stored

- Hosted on **Supabase** (managed Postgres) and served through **Vercel** — both reputable
  cloud providers on their free tiers.
- Each client has an isolated workspace ("tenant"). Isolation is enforced in the database
  itself (row-level security), not just in the app, and is verified by automated tests that
  attempt cross-client access and confirm it fails.

## How you sign in

- **Magic links only — no passwords.** You get a one-time link by email (or, since we mostly
  talk on WhatsApp, a link your studio contact sends you). Each link is single-use and expires.

## Who controls the data

- The workspace and its contents are **managed by the studio**. This is the studio's working
  environment for delivering your social-media work — the ideas, briefs and plans built here
  are part of that service.
- **Need a copy of something?** Just ask your studio contact. They can export your workspace
  (a full JSON + human-readable Markdown + spreadsheet-friendly CSV bundle) and share it with
  you. There is no self-serve export button inside the app.

## How your privacy is respected

- Application logs record **event names and record ids only** — never the text of your ideas,
  tasks, calendar entries or comments.
- Secrets (database keys, API tokens) are kept in server-side environment variables and are
  never shipped to your browser.
- Data flows **one way out**: an authenticated, read-only feed lets the studio's own tools
  read workspace activity to serve you better. Nothing writes back in through that door, and
  it is not exposed to the public.

_Questions about your data? Ask your studio contact — they can walk you through any of this._
