-- =====================================================================
-- 0005_attachments.sql  —  Draft approval + media (v1.5, item 4)
--
-- Two things:
--   1. public.attachments — polymorphic media rows (calendar drafts + idea
--      reference images). Either stored media (storage_path, in the private
--      `media` bucket) or an external link (Drive), never both.
--   2. calendar_entries.status gains the approval loop:
--        idea → drafted → awaiting_approval → approved → posted
--      plus the side-exit `changes_requested`.
--
-- Apply AFTER 0001-0004. Storage bucket + storage.objects policies live in
-- 0006_storage.sql (separate because the `storage` schema only exists on
-- hosted Supabase, not in the PGlite test harness).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. attachments
-- ---------------------------------------------------------------------
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  parent_type  text not null check (parent_type in ('idea','calendar')),
  parent_id    uuid not null,
  kind         text not null check (kind in ('image','video','drive')),
  storage_path text,
  external_url text,
  size_bytes   bigint not null default 0,
  mime         text,
  title        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),

  -- SECURITY (defence in depth): a stored object must live under the owning
  -- tenant's own top-level folder, because storage.objects RLS in 0006 derives
  -- access from exactly that first path segment. Without this, a member of
  -- tenant A could file a row in their own tenant that points at tenant B's
  -- object and get it signed for them. uuid::text is always 36 chars.
  constraint attachments_path_tenant_scoped check (
    storage_path is null
    or left(storage_path, 37) = tenant_id::text || '/'
  ),

  -- A row is stored media OR an external link — never both, never neither.
  constraint attachments_target_shape check (
    (kind = 'drive'  and external_url is not null and storage_path is null)
    or (kind in ('image','video') and storage_path is not null and external_url is null)
  ),

  -- Mirrors the bucket's 20 MB limit so a lying client can't inflate the
  -- storage-usage numbers the admin sees.
  constraint attachments_size_cap check (size_bytes >= 0 and size_bytes <= 20971520)
);

create index if not exists attachments_parent_idx
  on public.attachments (tenant_id, parent_type, parent_id, created_at desc);

-- One stored object maps to exactly one row (makes delete/cleanup unambiguous).
create unique index if not exists attachments_storage_path_key
  on public.attachments (storage_path) where storage_path is not null;

-- RLS — identical shape to every other domain table (see 0002).
alter table public.attachments enable row level security;
grant select, insert, update, delete on public.attachments to authenticated;

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select using (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments
  for insert with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists attachments_update on public.attachments;
create policy attachments_update on public.attachments
  for update using (public.is_admin() or public.is_member_of(tenant_id))
             with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments
  for delete using (public.is_admin() or public.is_member_of(tenant_id));

-- ---------------------------------------------------------------------
-- 2. Storage path → tenant id.
--
-- Lives here rather than in 0006 because it touches nothing in the `storage`
-- schema, so the PGlite suite can test the exact expression that the
-- storage.objects policies are built on.
--
-- Returns NULL instead of raising when the first path segment isn't a uuid: a
-- policy that throws would abort the whole request, whereas
-- is_member_of(null) is simply false — a malformed path fails closed.
-- ---------------------------------------------------------------------
create or replace function public.storage_tenant_id(objname text)
returns uuid
language sql
immutable
set search_path = public
as $$
  select case
    when split_part(objname, '/', 1) ~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then split_part(objname, '/', 1)::uuid
  end;
$$;

grant execute on function public.storage_tenant_id(text) to authenticated, anon;

-- ---------------------------------------------------------------------
-- 3. calendar approval statuses (CHECK swap: drop then re-add)
-- ---------------------------------------------------------------------
alter table public.calendar_entries
  drop constraint if exists calendar_entries_status_check;

alter table public.calendar_entries
  add constraint calendar_entries_status_check
  check (status in ('idea','drafted','awaiting_approval','approved','changes_requested','posted'));

-- Who signed off, and when. Written only by the client-approval action; kept
-- as columns (not just an activity row) so the sign-off survives log pruning.
alter table public.calendar_entries
  add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.calendar_entries
  add column if not exists approved_at timestamptz;

-- Fast "what's waiting on someone" lookups for both dashboards.
create index if not exists calendar_status_idx
  on public.calendar_entries (tenant_id, status, date);
