-- =====================================================================
-- 0006_storage.sql  —  Private `media` bucket + tenant-scoped storage RLS
--
-- Apply AFTER 0005. This is the ONLY migration that touches the `storage`
-- schema, which exists on hosted Supabase but NOT in the PGlite test harness
-- (tests/setup/db.ts deliberately does not load this file). Table-level
-- isolation is tested in PGlite; this file's isolation is verified live via a
-- signed-URL round-trip — see HANDOFF.
--
-- Object path contract (enforced on both sides):
--   {tenant_id}/{parent_type}/{parent_id}/{uuid}-{filename}
-- The FIRST path segment is the tenant id, and it is the whole basis for
-- access. public.attachments has a matching CHECK (0005) so a row can never
-- point outside its own tenant's folder.
--
-- ---------------------------------------------------------------------
-- OWNERSHIP GOTCHA — READ BEFORE RUNNING (cost two failed runs, 2026-08-09)
-- ---------------------------------------------------------------------
-- Only SECTION 1 of this file is runnable in the SQL Editor. Section 2 is
-- reference text that must be entered through the Dashboard. Why:
--
-- storage.objects is owned by `supabase_storage_admin`, not by the `postgres`
-- role the SQL Editor runs as. Both escape hatches are closed on this project:
--     create policy … on storage.objects  ->  ERROR 42501: must be owner of table objects
--     set role supabase_storage_admin      ->  ERROR 42501: permission denied to set role
-- `postgres` is not a member of that role, so there is no SQL path at all —
-- not via the editor, and not via `supabase db push` (same role, same limits).
--
-- Worse, the SQL Editor wraps a script in ONE transaction, so the failing
-- policy statements rolled back the bucket insert above them and left nothing
-- behind. Hence the split: bucket in SQL, policies via Dashboard.
--
-- Also note `alter table storage.objects enable row level security` is GONE.
-- It needed the same ownership and bought nothing — Supabase already enables
-- RLS on storage.objects for every project.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bucket: private (no public URLs — everything is served via short-lived
-- signed URLs), hard 20 MB per object.
--
-- Idempotent, and safe to run even though the live bucket was created through
-- the Storage API — this keeps the definition in version control so a rebuilt
-- project gets an identical bucket.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  20971520,  -- 20 MB, matches attachments_size_cap in 0005
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic',
    'video/mp4','video/quicktime','video/webm'
  ]
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================================
-- SECTION 2 — storage.objects RLS.  *** DO NOT RUN THIS SECTION IN SQL ***
--
-- APPLIED LIVE on 2026-08-09 through:
--   Dashboard → Storage → Policies → "OTHER POLICIES UNDER STORAGE.OBJECTS"
--   → New policy → full customization.
-- Recorded here verbatim (as the dashboard generated it) so the live rule stays
-- reviewable in git, and so a rebuilt project can be brought to the same state.
--
-- ONE policy with FOR ALL rather than four per-operation ones — the dashboard
-- offers it and the semantics are identical: USING covers SELECT/UPDATE/DELETE,
-- WITH CHECK covers INSERT/UPDATE. Fewer hand-typed expressions, fewer typos.
--
-- Same rule as every domain table, keyed off the first path folder: you may
-- touch an object only inside your own tenant's folder (admin spans all).
--
-- NOTE: public.storage_tenant_id(text) — the path → tenant id function this
-- policy is built on — is defined in 0005 on purpose. It touches nothing in
-- the `storage` schema, so keeping it there lets the PGlite suite test the
-- exact expression that guards the bucket.
--
-- VERIFIED LIVE by `npm run probe:storage` (scripts/probe-storage.ts), which
-- signs in as a real throwaway client and proves, against the real tenant:
-- upload into own folder allowed; upload into another tenant's folder denied;
-- own path signs and serves bytes; another tenant's existing object refuses to
-- sign; listing another tenant's folder returns nothing.
-- =====================================================================
--
-- CREATE POLICY "media_tenant_scoped" ON "storage"."objects"
-- AS PERMISSIVE FOR ALL
-- TO authenticated
-- USING (bucket_id = 'media' and (public.is_admin() or public.is_member_of(public.storage_tenant_id(name))))
-- WITH CHECK (bucket_id = 'media' and (public.is_admin() or public.is_member_of(public.storage_tenant_id(name))));
