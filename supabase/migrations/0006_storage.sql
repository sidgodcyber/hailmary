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
-- If `create policy on storage.objects` errors with "must be owner of table
-- objects", create the four policies through Dashboard → Storage → Policies
-- with the same USING/WITH CHECK expressions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bucket: private (no public URLs — everything is served via short-lived
-- signed URLs), hard 20 MB per object.
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

-- ---------------------------------------------------------------------
-- NOTE: public.storage_tenant_id(text) — the path → tenant id function these
-- policies are built on — is defined in 0005 on purpose. It touches nothing in
-- the `storage` schema, so keeping it there lets the PGlite suite test the
-- exact expression that guards the bucket.
-- ---------------------------------------------------------------------
-- storage.objects RLS — same rule as every domain table, keyed off the
-- first path folder: you may touch an object only inside your own tenant's
-- folder (admin spans all).
-- ---------------------------------------------------------------------
alter table storage.objects enable row level security;

drop policy if exists media_select on storage.objects;
create policy media_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and (public.is_admin() or public.is_member_of(public.storage_tenant_id(name)))
  );

drop policy if exists media_insert on storage.objects;
create policy media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (public.is_admin() or public.is_member_of(public.storage_tenant_id(name)))
  );

drop policy if exists media_update on storage.objects;
create policy media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (public.is_admin() or public.is_member_of(public.storage_tenant_id(name)))
  )
  with check (
    bucket_id = 'media'
    and (public.is_admin() or public.is_member_of(public.storage_tenant_id(name)))
  );

drop policy if exists media_delete on storage.objects;
create policy media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (public.is_admin() or public.is_member_of(public.storage_tenant_id(name)))
  );
