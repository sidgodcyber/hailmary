# Test Supabase RLS without Docker, using PGlite

The machine had no Docker, so `supabase start` (local Supabase) was not an option for the
adversarial isolation tests. Solution: **PGlite** (`@electric-sql/pglite`) — a real Postgres
compiled to WASM that runs in-process in Node.

How it works (`tests/setup/db.ts`):
- Boot a PGlite instance, then create the pieces hosted Supabase provides but PGlite doesn't:
  an `auth` schema, a stub `auth.users` table, an `auth.uid()` that reads
  `current_setting('request.jwt.claims')::jsonb->>'sub'`, and the `anon`/`authenticated`/
  `service_role` roles.
- Apply the **real** migration SQL files (so tests exercise production policies, not a copy).
- Impersonate a user with `set role authenticated` + `set_config('request.jwt.claims', …)`,
  exactly as PostgREST does per request. `reset role` returns to the privileged (service) role.

Key facts:
- The default PGlite role is a superuser and **bypasses RLS** — you must `SET ROLE
  authenticated` to actually test policies.
- `SECURITY DEFINER` helper functions run as their owner (the superuser here), so they read
  `profiles`/`memberships` without tripping RLS → no recursion. Same behavior as Supabase
  (functions owned by `postgres`).
- Custom GUCs with a dot (`request.jwt.claims`) are settable at session scope without prior
  declaration.

Production still uses hosted Supabase (no Docker anywhere). This is a strict win for a
solo/$0 setup. Related: [[multi-tenant-rls-model]].
