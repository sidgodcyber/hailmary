import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actAsService, makeTestDb, type TestDb } from "./setup/db";
import { bearerOk } from "../src/lib/apiAuth";

describe("bearerOk (Gravity read-API auth)", () => {
  const TOKEN = "s3cr3t-token-value-0123456789";
  it("rejects when no token is configured", () => {
    expect(bearerOk(`Bearer ${TOKEN}`, undefined)).toBe(false);
  });
  it("rejects a missing or malformed header", () => {
    expect(bearerOk(null, TOKEN)).toBe(false);
    expect(bearerOk(TOKEN, TOKEN)).toBe(false); // no "Bearer " prefix
    expect(bearerOk("Bearer ", TOKEN)).toBe(false);
  });
  it("rejects a wrong token", () => {
    expect(bearerOk("Bearer wrong", TOKEN)).toBe(false);
    expect(bearerOk(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
  });
  it("accepts the exact token", () => {
    expect(bearerOk(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });
});

describe("check_rate_limit (Postgres fixed window)", () => {
  let pg: TestDb;
  beforeAll(async () => {
    pg = await makeTestDb();
    await actAsService(pg);
  });
  afterAll(async () => {
    await pg?.close?.();
  });

  it("allows up to the max, then blocks within the window", async () => {
    const key = `k-${randomUUID()}`;
    const call = async () => {
      const r = await pg.query<{ ok: boolean }>(
        "select public.check_rate_limit($1, $2, $3) as ok",
        [key, 3, 60]
      );
      return r.rows[0]!.ok;
    };
    expect(await call()).toBe(true);
    expect(await call()).toBe(true);
    expect(await call()).toBe(true);
    expect(await call()).toBe(false); // 4th within the same window
  });

  it("keeps separate budgets per key", async () => {
    const a = await pg.query<{ ok: boolean }>("select public.check_rate_limit($1,$2,$3) as ok", [
      `a-${randomUUID()}`,
      1,
      60,
    ]);
    const b = await pg.query<{ ok: boolean }>("select public.check_rate_limit($1,$2,$3) as ok", [
      `b-${randomUUID()}`,
      1,
      60,
    ]);
    expect(a.rows[0]!.ok).toBe(true);
    expect(b.rows[0]!.ok).toBe(true);
  });
});

describe("activity read query (what the Gravity route runs)", () => {
  let pg: TestDb;
  const T_A = randomUUID();
  const T_B = randomUUID();

  beforeAll(async () => {
    pg = await makeTestDb();
    await actAsService(pg);
    await pg.exec(`
      insert into public.tenants (id, name, slug) values
        ('${T_A}', 'A', 'a'), ('${T_B}', 'B', 'b');
      insert into public.activity (tenant_id, verb, object_type, summary, created_at) values
        ('${T_A}', 'idea.created', 'idea', 'A old', '2026-01-01T00:00:00Z'),
        ('${T_A}', 'task.created', 'task', 'A new', '2026-06-01T00:00:00Z'),
        ('${T_B}', 'idea.created', 'idea', 'B row', '2026-06-01T00:00:00Z');
    `);
  });
  afterAll(async () => {
    await pg?.close?.();
  });

  it("returns only the requested tenant's activity", async () => {
    const res = await pg.query<{ tenant_id: string; summary: string }>(
      "select tenant_id, summary from public.activity where tenant_id = $1 order by created_at asc",
      [T_A]
    );
    expect(res.rows.length).toBe(2);
    expect(res.rows.every((r) => r.tenant_id === T_A)).toBe(true);
  });

  it("honors the `since` filter", async () => {
    const res = await pg.query<{ summary: string }>(
      "select summary from public.activity where tenant_id = $1 and created_at > $2 order by created_at asc",
      [T_A, "2026-03-01T00:00:00Z"]
    );
    expect(res.rows.map((r) => r.summary)).toEqual(["A new"]);
  });
});
