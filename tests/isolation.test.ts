import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actAs, actAsService, makeTestDb, type TestDb } from "./setup/db";

/**
 * Adversarial multi-tenant isolation tests.
 *
 * Two tenants (A = Shunyethra, B = Roven), a client in each, and one admin.
 * A logged-in client of tenant A must NOT be able to read or write any of
 * tenant B's rows. Admin must be able to span both. Enforcement is Postgres
 * RLS from supabase/migrations — these tests exercise the real policies.
 */

const T_A = randomUUID(); // Shunyethra
const T_B = randomUUID(); // Roven
const U_CLIENT_A = randomUUID();
const U_CLIENT_B = randomUUID();
const U_ADMIN = randomUUID();

// Tenant B rows a tenant-A client will try (and must fail) to touch.
const IDEA_B = randomUUID();
const TASK_B = randomUUID();
const CAL_B = randomUUID();
const COMMENT_B = randomUUID();
const ACT_B = randomUUID();

// A tenant-A idea, to prove same-tenant access works.
const IDEA_A = randomUUID();

let pg: TestDb;

beforeAll(async () => {
  pg = await makeTestDb();

  // ---- Seed as the privileged (service) role, bypassing RLS. ----
  await actAsService(pg);

  await pg.exec(`
    insert into auth.users (id, email) values
      ('${U_CLIENT_A}', 'client-a@example.com'),
      ('${U_CLIENT_B}', 'client-b@example.com'),
      ('${U_ADMIN}',    'admin@example.com');

    insert into public.profiles (id, email, full_name, global_role) values
      ('${U_CLIENT_A}', 'client-a@example.com', 'Client A', 'client'),
      ('${U_CLIENT_B}', 'client-b@example.com', 'Client B', 'client'),
      ('${U_ADMIN}',    'admin@example.com',    'Admin',    'admin');

    insert into public.tenants (id, name, slug) values
      ('${T_A}', 'Shunyethra', 'shunyethra'),
      ('${T_B}', 'Roven',      'roven');

    insert into public.memberships (tenant_id, user_id, role) values
      ('${T_A}', '${U_CLIENT_A}', 'client'),
      ('${T_B}', '${U_CLIENT_B}', 'client');

    insert into public.ideas (id, tenant_id, author_id, type, title, body) values
      ('${IDEA_A}', '${T_A}', '${U_CLIENT_A}', 'idea', 'A idea', 'belongs to A'),
      ('${IDEA_B}', '${T_B}', '${U_CLIENT_B}', 'idea', 'B idea', 'belongs to B');

    insert into public.tasks (id, tenant_id, title, created_by) values
      ('${TASK_B}', '${T_B}', 'B task', '${U_CLIENT_B}');

    insert into public.calendar_entries (id, tenant_id, title, date, created_by) values
      ('${CAL_B}', '${T_B}', 'B post', '2026-07-20', '${U_CLIENT_B}');

    insert into public.comments (id, tenant_id, parent_type, parent_id, author_id, body) values
      ('${COMMENT_B}', '${T_B}', 'idea', '${IDEA_B}', '${U_CLIENT_B}', 'B comment');

    insert into public.activity (id, tenant_id, actor_id, verb, object_type, object_id, summary) values
      ('${ACT_B}', '${T_B}', '${U_CLIENT_B}', 'idea.created', 'idea', '${IDEA_B}', 'B did a thing');
  `);
});

afterAll(async () => {
  await pg?.close?.();
});

describe("a logged-in client of tenant A", () => {
  beforeAll(async () => {
    await actAs(pg, U_CLIENT_A);
  });

  it("sees only its own tenant's ideas", async () => {
    const res = await pg.query<{ id: string; tenant_id: string }>(
      "select id, tenant_id from public.ideas order by created_at"
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].id).toBe(IDEA_A);
    expect(res.rows.every((r) => r.tenant_id === T_A)).toBe(true);
  });

  it("cannot read tenant B's rows across every table (0 rows)", async () => {
    for (const [table, id] of [
      ["ideas", IDEA_B],
      ["tasks", TASK_B],
      ["calendar_entries", CAL_B],
      ["comments", COMMENT_B],
      ["activity", ACT_B],
    ] as const) {
      const res = await pg.query(`select id from public.${table} where id = $1`, [id]);
      expect(res.rows.length, `${table} should be invisible to tenant A`).toBe(0);
    }
  });

  it("cannot see tenant B exists (tenants table scoped)", async () => {
    const res = await pg.query("select id from public.tenants");
    expect(res.rows.length).toBe(1);
    expect((res.rows[0] as { id: string }).id).toBe(T_A);
  });

  it("is REJECTED when inserting a row into tenant B", async () => {
    await expect(
      pg.query(
        "insert into public.ideas (tenant_id, title, body) values ($1,$2,$3)",
        [T_B, "sneaky", "cross-tenant insert"]
      )
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("cannot UPDATE tenant B's idea (0 rows affected, value unchanged)", async () => {
    const res = await pg.query(
      "update public.ideas set title = 'hijacked' where id = $1",
      [IDEA_B]
    );
    expect(res.affectedRows ?? 0).toBe(0);

    await actAsService(pg);
    const check = await pg.query<{ title: string }>(
      "select title from public.ideas where id = $1",
      [IDEA_B]
    );
    expect(check.rows[0].title).toBe("B idea");
    await actAs(pg, U_CLIENT_A);
  });

  it("cannot DELETE tenant B's task (0 rows affected, still present)", async () => {
    const res = await pg.query("delete from public.tasks where id = $1", [TASK_B]);
    expect(res.affectedRows ?? 0).toBe(0);

    await actAsService(pg);
    const check = await pg.query("select id from public.tasks where id = $1", [TASK_B]);
    expect(check.rows.length).toBe(1);
    await actAs(pg, U_CLIENT_A);
  });

  it("CAN read and write within its own tenant A", async () => {
    const read = await pg.query("select id from public.ideas where id = $1", [IDEA_A]);
    expect(read.rows.length).toBe(1);

    const ins = await pg.query<{ id: string; tenant_id: string }>(
      "insert into public.tasks (tenant_id, title, created_by) values ($1,$2,$3) returning id, tenant_id",
      [T_A, "A owns this", U_CLIENT_A]
    );
    expect(ins.rows[0].tenant_id).toBe(T_A);
  });
});

describe("the admin", () => {
  beforeAll(async () => {
    await actAs(pg, U_ADMIN);
  });

  it("sees ideas across BOTH tenants", async () => {
    const res = await pg.query<{ tenant_id: string }>("select tenant_id from public.ideas");
    const tenants = new Set(res.rows.map((r) => r.tenant_id));
    expect(tenants.has(T_A)).toBe(true);
    expect(tenants.has(T_B)).toBe(true);
  });

  it("can write into any tenant", async () => {
    const res = await pg.query<{ tenant_id: string }>(
      "insert into public.ideas (tenant_id, title, body) values ($1,$2,$3) returning tenant_id",
      [T_B, "admin note on B", "allowed"]
    );
    expect(res.rows[0].tenant_id).toBe(T_B);
  });
});

describe("an anonymous (no session) caller", () => {
  beforeAll(async () => {
    await actAs(pg, randomUUID()); // a valid-looking sub with no profile/membership
  });

  it("sees nothing", async () => {
    const ideas = await pg.query("select id from public.ideas");
    expect(ideas.rows.length).toBe(0);
    const tenants = await pg.query("select id from public.tenants");
    expect(tenants.rows.length).toBe(0);
  });
});
