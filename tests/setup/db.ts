import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Spin up a real Postgres (PGlite / WASM, in-process — no Docker) with the
 * exact migration SQL applied, plus the small set of things hosted Supabase
 * provides that PGlite does not: the `auth` schema, an `auth.users` table,
 * `auth.uid()`, and the anon/authenticated/service_role roles.
 *
 * This lets the adversarial RLS tests run the *actual* production policies.
 */

const MIGRATIONS = ["0001_schema.sql", "0002_rls.sql", "0003_functions.sql"];

function migrationSql(file: string): string {
  return readFileSync(resolve(process.cwd(), "supabase", "migrations", file), "utf8");
}

const BOOTSTRAP = `
create schema if not exists auth;

create table if not exists auth.users (
  id    uuid primary key,
  email text
);

-- Compatible with Supabase's auth.uid(): read the JWT 'sub' claim from the
-- request.jwt.claims GUC that the app/PostgREST sets per request.
create or replace function auth.uid() returns uuid
language sql stable
as $fn$
  select nullif(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    ''
  )::uuid
$fn$;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$roles$;
`;

export type TestDb = PGlite;

export async function makeTestDb(): Promise<TestDb> {
  const pg = new PGlite();
  await pg.exec(BOOTSTRAP);
  for (const f of MIGRATIONS) {
    await pg.exec(migrationSql(f));
  }
  return pg;
}

/**
 * Impersonate a portal user for subsequent queries: switch to the
 * `authenticated` role and set the JWT 'sub' claim, exactly as PostgREST does
 * for a logged-in request. RLS is fully enforced for this role.
 */
export async function actAs(pg: TestDb, userId: string): Promise<void> {
  await pg.exec("reset role;");
  await pg.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  await pg.exec("set role authenticated;");
}

/**
 * Drop back to the privileged bootstrap role with no JWT claims — mirrors the
 * server-only service_role path used by the seed script / admin export, which
 * bypasses RLS. Used here only to set up and verify fixtures.
 */
export async function actAsService(pg: TestDb): Promise<void> {
  await pg.exec("reset role;");
  await pg.query("select set_config('request.jwt.claims', $1, false)", [""]);
}
