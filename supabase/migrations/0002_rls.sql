-- =====================================================================
-- 0002_rls.sql  —  Row Level Security: helpers + policies
-- Tenant isolation is enforced HERE, at the database layer, for the
-- `authenticated` role. The `service_role` (used only server-side by the
-- seed script, admin export, and the Gravity read API) bypasses RLS.
--
-- Helpers are SECURITY DEFINER so evaluating a policy never re-triggers RLS
-- on profiles/memberships (no infinite recursion).
-- =====================================================================

-- current user is a global admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.global_role = 'admin'
  );
$$;

-- current user is a member of tenant tid?
create or replace function public.is_member_of(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = tid
  );
$$;

-- ---------------------------------------------------------------------
-- Grants: the `authenticated` role gets table DML; RLS then constrains it.
-- (Hosted Supabase usually grants these already; repeating is harmless and
--  keeps the schema self-contained for PGlite tests.)
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_member_of(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------
-- Enable RLS on every table.
-- ---------------------------------------------------------------------
alter table public.tenants           enable row level security;
alter table public.profiles          enable row level security;
alter table public.memberships       enable row level security;
alter table public.ideas             enable row level security;
alter table public.comments          enable row level security;
alter table public.tasks             enable row level security;
alter table public.calendar_entries  enable row level security;
alter table public.activity          enable row level security;

-- ---------------------------------------------------------------------
-- tenants: members (or admin) may read their tenant; only admin writes.
-- ---------------------------------------------------------------------
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants
  for select using (public.is_admin() or public.is_member_of(id));

drop policy if exists tenants_admin_write on public.tenants;
create policy tenants_admin_write on public.tenants
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- profiles: a user reads their own row; admin reads all. Writes are
-- service-role only (invite flow / seed) — no policy grants normal writes.
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- memberships: a user reads their own; admin reads all. Admin writes.
-- ---------------------------------------------------------------------
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists memberships_admin_write on public.memberships;
create policy memberships_admin_write on public.memberships
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Domain tables: full access scoped to the caller's tenant (admin spans all).
-- One block per table; identical shape.
-- ---------------------------------------------------------------------

-- ideas
drop policy if exists ideas_select on public.ideas;
create policy ideas_select on public.ideas
  for select using (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists ideas_insert on public.ideas;
create policy ideas_insert on public.ideas
  for insert with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists ideas_update on public.ideas;
create policy ideas_update on public.ideas
  for update using (public.is_admin() or public.is_member_of(tenant_id))
             with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists ideas_delete on public.ideas;
create policy ideas_delete on public.ideas
  for delete using (public.is_admin() or public.is_member_of(tenant_id));

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select using (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists comments_update on public.comments;
create policy comments_update on public.comments
  for update using (public.is_admin() or public.is_member_of(tenant_id))
             with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete using (public.is_admin() or public.is_member_of(tenant_id));

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update using (public.is_admin() or public.is_member_of(tenant_id))
             with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete using (public.is_admin() or public.is_member_of(tenant_id));

-- calendar_entries
drop policy if exists calendar_select on public.calendar_entries;
create policy calendar_select on public.calendar_entries
  for select using (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists calendar_insert on public.calendar_entries;
create policy calendar_insert on public.calendar_entries
  for insert with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists calendar_update on public.calendar_entries;
create policy calendar_update on public.calendar_entries
  for update using (public.is_admin() or public.is_member_of(tenant_id))
             with check (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists calendar_delete on public.calendar_entries;
create policy calendar_delete on public.calendar_entries
  for delete using (public.is_admin() or public.is_member_of(tenant_id));

-- activity  (insert happens via server actions / service role; reads are scoped)
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity
  for select using (public.is_admin() or public.is_member_of(tenant_id));
drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity
  for insert with check (public.is_admin() or public.is_member_of(tenant_id));
