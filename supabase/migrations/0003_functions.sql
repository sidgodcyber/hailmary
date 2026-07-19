-- =====================================================================
-- 0003_functions.sql  —  rate limiting for the Gravity read API
-- A Postgres-backed fixed-window counter so the limit holds across
-- ephemeral serverless instances (in-memory limiting would not).
-- Called only server-side via the service_role client.
-- =====================================================================

create table if not exists public.api_rate_counters (
  bucket_key   text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (bucket_key, window_start)
);

-- Locked down: only service_role / SECURITY DEFINER touch this table.
alter table public.api_rate_counters enable row level security;

-- Increment the counter for (key, current window) and report whether the
-- request is within budget. Returns true when allowed, false when over.
create or replace function public.check_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count  int;
begin
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_counters (bucket_key, window_start, count)
    values (p_key, v_window, 1)
  on conflict (bucket_key, window_start)
    do update set count = public.api_rate_counters.count + 1
  returning count into v_count;

  -- opportunistic cleanup of stale windows
  delete from public.api_rate_counters where window_start < now() - interval '1 hour';

  return v_count <= p_max;
end;
$$;
