-- =====================================================================
-- 0004_assets.sql  —  Raw asset (footage) tracker (v1.5, item 3)
-- Per-tenant footage pipeline: a Drive link + label that moves through a
-- manual status chain. Same tenant-scoped RLS as every other domain table.
-- Apply AFTER 0001-0003.
-- =====================================================================

create table if not exists public.assets (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  label                    text not null,
  drive_url                text,
  status                   text not null default 'new'
                           check (status in ('new','downloaded','editing','edited','used')),
  note                     text not null default '',
  linked_calendar_entry_id uuid references public.calendar_entries(id) on delete set null,
  created_by               uuid references public.profiles(id) on delete set null,
  updated_by               uuid references public.profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists assets_tenant_idx on public.assets (tenant_id, status, created_at desc);

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at before update on public.assets
  for each row execute function public.set_updated_at();

-- RLS — identical shape to the other domain tables (see 0002).
alter table public.assets enable row level security;
grant select, insert, update, delete on public.assets to authenticated;

drop policy if exists assets_select on public.assets;
create policy assets_select on public.assets
  for select using (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets
  for insert with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets
  for update using (public.is_admin() or public.is_member_of(tenant_id))
             with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets
  for delete using (public.is_admin() or public.is_member_of(tenant_id));
