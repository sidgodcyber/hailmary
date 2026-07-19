-- =====================================================================
-- 0001_schema.sql  —  Hailmary core schema
-- Every domain table carries tenant_id. RLS policies are added in 0002.
-- Portable across hosted Supabase (Postgres 15) and PGlite tests (Postgres 16).
-- Requires an `auth` schema with `auth.uid()` and an `auth.users` table:
--   * hosted Supabase provides these,
--   * the PGlite test bootstrap creates compatible shims (see tests/setup).
-- =====================================================================

-- Tenants (clients). Shunyethra is tenant #1 (created by the seed script).
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

-- Profiles mirror auth.users; global_role decides admin vs client.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  global_role text not null default 'client' check (global_role in ('admin','client')),
  created_at  timestamptz not null default now()
);

-- Which user belongs to which tenant (clients). Admins need no membership.
create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'client' check (role in ('client','admin')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- Ideas board + reference briefs.
create table if not exists public.ideas (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  type        text not null default 'idea' check (type in ('idea','reference')),
  title       text not null,
  body        text not null default '',
  status      text not null default 'new'
              check (status in ('new','discussing','planned','done','parked')),
  voice_note_path text,
  -- reference-brief structured fields (used when type = 'reference')
  ref_url        text,
  ref_likes      text,
  ref_like_tags  text[] not null default '{}',
  maps_to_product text,
  ref_notes      text,
  -- structured brief (editable by both sides)
  brief_concept   text,
  brief_hook      text,
  brief_outline   text,
  brief_caption   text,
  brief_updated_at timestamptz,
  brief_updated_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ideas_tenant_idx on public.ideas (tenant_id, created_at desc);

-- Comment threads for ideas AND calendar entries (polymorphic parent).
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  parent_type text not null check (parent_type in ('idea','calendar')),
  parent_id   uuid not null,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_parent_idx
  on public.comments (tenant_id, parent_type, parent_id, created_at);

-- Tasks.
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  title       text not null,
  details     text not null default '',
  assigned_to text not null default 'admin' check (assigned_to in ('admin','client')),
  due_date    date,
  status      text not null default 'open' check (status in ('open','in_progress','done')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_tenant_idx on public.tasks (tenant_id, created_at desc);

-- Shared content calendar. Edits are attributed via updated_by + activity log.
create table if not exists public.calendar_entries (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  title          text not null,
  date           date not null,
  channel        text not null default 'instagram'
                 check (channel in ('instagram','whatsapp','other')),
  status         text not null default 'idea'
                 check (status in ('idea','drafted','approved','posted')),
  linked_idea_id uuid references public.ideas(id) on delete set null,
  -- brief carried over from a reference brief on "send to calendar"
  brief_concept  text,
  brief_hook     text,
  brief_outline  text,
  brief_caption  text,
  created_by     uuid references public.profiles(id) on delete set null,
  updated_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists calendar_tenant_idx on public.calendar_entries (tenant_id, date);

-- Activity feed (reverse-chron) AND the Gravity ingestion surface.
-- payload holds the full record so the read API can return complete data.
create table if not exists public.activity (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  verb        text not null,
  object_type text not null,
  object_id   uuid,
  summary     text not null default '',
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_tenant_idx on public.activity (tenant_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ideas_set_updated_at on public.ideas;
create trigger ideas_set_updated_at before update on public.ideas
  for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

drop trigger if exists calendar_set_updated_at on public.calendar_entries;
create trigger calendar_set_updated_at before update on public.calendar_entries
  for each row execute function public.set_updated_at();
