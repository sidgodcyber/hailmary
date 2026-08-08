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
const ASSET_B = randomUUID();
const ATTACH_B = randomUUID();

// A tenant-A idea, to prove same-tenant access works.
const IDEA_A = randomUUID();
const CAL_A = randomUUID();

// Object paths in the private `media` bucket. The first path segment is the
// tenant id — that segment is the whole basis for storage access (0006).
const PATH_B = `${T_B}/calendar/${CAL_B}/${randomUUID()}-b-draft.jpg`;

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
      ('${CAL_A}', '${T_A}', 'A post', '2026-07-20', '${U_CLIENT_A}'),
      ('${CAL_B}', '${T_B}', 'B post', '2026-07-20', '${U_CLIENT_B}');

    insert into public.comments (id, tenant_id, parent_type, parent_id, author_id, body) values
      ('${COMMENT_B}', '${T_B}', 'idea', '${IDEA_B}', '${U_CLIENT_B}', 'B comment');

    insert into public.activity (id, tenant_id, actor_id, verb, object_type, object_id, summary) values
      ('${ACT_B}', '${T_B}', '${U_CLIENT_B}', 'idea.created', 'idea', '${IDEA_B}', 'B did a thing');

    insert into public.assets (id, tenant_id, label, status, created_by) values
      ('${ASSET_B}', '${T_B}', 'B footage', 'new', '${U_CLIENT_B}');

    insert into public.attachments
      (id, tenant_id, parent_type, parent_id, kind, storage_path, size_bytes, mime, created_by) values
      ('${ATTACH_B}', '${T_B}', 'calendar', '${CAL_B}', 'image', '${PATH_B}', 2048, 'image/jpeg', '${U_CLIENT_B}');
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
      ["assets", ASSET_B],
      ["attachments", ATTACH_B],
    ] as const) {
      const res = await pg.query(`select id from public.${table} where id = $1`, [id]);
      expect(res.rows.length, `${table} should be invisible to tenant A`).toBe(0);
    }
  });

  it("is REJECTED when inserting an asset into tenant B", async () => {
    await expect(
      pg.query("insert into public.assets (tenant_id, label) values ($1,$2)", [T_B, "sneaky footage"])
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("cannot UPDATE tenant B's asset (0 rows affected)", async () => {
    const res = await pg.query("update public.assets set status = 'used' where id = $1", [ASSET_B]);
    expect(res.affectedRows ?? 0).toBe(0);
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

  // -------------------------------------------------------------------
  // Draft media (v1.5 item 4). The dangerous case is not reading tenant B's
  // attachment ROW — it's getting a path inside tenant B's storage folder
  // recorded under tenant A, because the app signs URLs from that path.
  // -------------------------------------------------------------------

  it("is REJECTED when filing an attachment into tenant B", async () => {
    await expect(
      pg.query(
        `insert into public.attachments (tenant_id, parent_type, parent_id, kind, storage_path)
         values ($1,'calendar',$2,'image',$3)`,
        [T_B, CAL_B, `${T_B}/calendar/${CAL_B}/stolen.jpg`]
      )
    ).rejects.toThrow(/row-level security|violates/i);
  });

  it("is REJECTED when claiming a storage path inside tenant B's folder", async () => {
    // The row is filed under A (so RLS is satisfied) but points at B's folder.
    // Without the CHECK constraint this would sign B's media for A.
    await expect(
      pg.query(
        `insert into public.attachments (tenant_id, parent_type, parent_id, kind, storage_path)
         values ($1,'calendar',$2,'image',$3)`,
        [T_A, CAL_A, PATH_B]
      )
    ).rejects.toThrow(/attachments_path_tenant_scoped|violates check/i);
  });

  it("cannot REPOINT its own attachment at tenant B's folder afterwards", async () => {
    const mine = await pg.query<{ id: string }>(
      `insert into public.attachments (tenant_id, parent_type, parent_id, kind, storage_path, size_bytes)
       values ($1,'calendar',$2,'image',$3,1024) returning id`,
      [T_A, CAL_A, `${T_A}/calendar/${CAL_A}/mine.jpg`]
    );
    await expect(
      pg.query("update public.attachments set storage_path = $1 where id = $2", [
        PATH_B,
        mine.rows[0]!.id,
      ])
    ).rejects.toThrow(/attachments_path_tenant_scoped|violates check/i);
  });

  it("cannot UPDATE or DELETE tenant B's attachment (0 rows, still present)", async () => {
    const upd = await pg.query("update public.attachments set title = 'hijacked' where id = $1", [
      ATTACH_B,
    ]);
    expect(upd.affectedRows ?? 0).toBe(0);

    const del = await pg.query("delete from public.attachments where id = $1", [ATTACH_B]);
    expect(del.affectedRows ?? 0).toBe(0);

    await actAsService(pg);
    const check = await pg.query("select id from public.attachments where id = $1", [ATTACH_B]);
    expect(check.rows.length).toBe(1);
    await actAs(pg, U_CLIENT_A);
  });

  it("is REJECTED when forging an oversized or malformed attachment", async () => {
    // Size cap mirrors the bucket limit, so usage numbers can't be inflated.
    await expect(
      pg.query(
        `insert into public.attachments (tenant_id, parent_type, parent_id, kind, storage_path, size_bytes)
         values ($1,'calendar',$2,'image',$3,$4)`,
        [T_A, CAL_A, `${T_A}/calendar/${CAL_A}/huge.jpg`, 20971521]
      )
    ).rejects.toThrow(/attachments_size_cap|violates check/i);

    // An 'image' row with no storage_path (or a link row with both) is nonsense.
    await expect(
      pg.query(
        `insert into public.attachments (tenant_id, parent_type, parent_id, kind, external_url)
         values ($1,'calendar',$2,'image','https://example.com/x.jpg')`,
        [T_A, CAL_A]
      )
    ).rejects.toThrow(/attachments_target_shape|violates check/i);
  });

  it("CAN attach media inside its own tenant folder", async () => {
    const res = await pg.query<{ tenant_id: string; storage_path: string }>(
      `insert into public.attachments (tenant_id, parent_type, parent_id, kind, storage_path, size_bytes, mime, created_by)
       values ($1,'calendar',$2,'image',$3,4096,'image/jpeg',$4)
       returning tenant_id, storage_path`,
      [T_A, CAL_A, `${T_A}/calendar/${CAL_A}/ok.jpg`, U_CLIENT_A]
    );
    expect(res.rows[0]!.tenant_id).toBe(T_A);
    expect(res.rows[0]!.storage_path.startsWith(`${T_A}/`)).toBe(true);
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

/**
 * The `media` bucket's storage.objects policies (0006) read exactly:
 *   is_admin() OR is_member_of(public.storage_tenant_id(name))
 * The storage schema doesn't exist in PGlite, but that predicate is plain
 * public-schema SQL — so evaluate it here against real object paths. This is
 * the closest we get to testing the bucket without hosted Supabase; the bucket
 * policies themselves still need the live signed-URL round-trip.
 */
describe("the storage path predicate that guards the media bucket", () => {
  const objectPath = (tenant: string) => `${tenant}/calendar/${CAL_A}/${randomUUID()}-x.jpg`;

  async function predicate(path: string): Promise<boolean> {
    const res = await pg.query<{ ok: boolean }>(
      "select (public.is_admin() or public.is_member_of(public.storage_tenant_id($1))) as ok",
      [path]
    );
    return res.rows[0]!.ok;
  }

  it("extracts the tenant id from the first path segment", async () => {
    await actAsService(pg);
    const res = await pg.query<{ got: string | null }>(
      "select public.storage_tenant_id($1)::text as got",
      [objectPath(T_B)]
    );
    expect(res.rows[0]!.got).toBe(T_B);
  });

  it("returns NULL (fails closed) for a path whose first segment isn't a uuid", async () => {
    await actAsService(pg);
    for (const bad of ["", "public/x.jpg", "../secrets.jpg", "not-a-uuid/calendar/x.jpg"]) {
      const res = await pg.query<{ got: string | null }>(
        "select public.storage_tenant_id($1)::text as got",
        [bad]
      );
      expect(res.rows[0]!.got, `${bad || "(empty)"} must not resolve to a tenant`).toBeNull();
    }
  });

  it("grants tenant A's client only its own folder", async () => {
    await actAs(pg, U_CLIENT_A);
    expect(await predicate(objectPath(T_A))).toBe(true);
    expect(await predicate(objectPath(T_B))).toBe(false);
    expect(await predicate("not-a-uuid/calendar/x.jpg")).toBe(false);
    // A uuid that is nobody's tenant must not grant access either.
    expect(await predicate(objectPath(randomUUID()))).toBe(false);
  });

  it("grants the admin every folder, and a stranger none", async () => {
    await actAs(pg, U_ADMIN);
    expect(await predicate(objectPath(T_A))).toBe(true);
    expect(await predicate(objectPath(T_B))).toBe(true);

    await actAs(pg, randomUUID()); // valid-looking sub, no profile/membership
    expect(await predicate(objectPath(T_A))).toBe(false);
    expect(await predicate(objectPath(T_B))).toBe(false);
  });
});

describe("the calendar approval status constraint", () => {
  beforeAll(async () => {
    await actAsService(pg);
  });

  it("accepts every status the app can set", async () => {
    for (const status of [
      "idea",
      "drafted",
      "awaiting_approval",
      "approved",
      "changes_requested",
      "posted",
    ]) {
      const res = await pg.query<{ status: string }>(
        "update public.calendar_entries set status = $1 where id = $2 returning status",
        [status, CAL_A]
      );
      expect(res.rows[0]!.status).toBe(status);
    }
  });

  it("rejects a status outside the approval vocabulary", async () => {
    await expect(
      pg.query("update public.calendar_entries set status = $1 where id = $2", ["yolo", CAL_A])
    ).rejects.toThrow(/calendar_entries_status_check|violates check/i);
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
