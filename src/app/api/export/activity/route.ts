import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bearerOk } from "@/lib/apiAuth";
import { EXPORT_API_RATE } from "@/lib/config";
import { logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gravity read API — the ONE-WAY door out of the portal.
 *
 *   GET /api/export/activity?tenant=<uuid>&since=<ISO8601>
 *   Authorization: Bearer <GRAVITY_EXPORT_TOKEN>
 *
 * Read-only. Returns a tenant's activity rows (with full payloads) after
 * `since`, oldest-first for incremental ingestion. Rate-limited per tenant.
 * The token is server-only (env), never shipped to any client.
 */
export async function GET(req: Request) {
  if (!bearerOk(req.headers.get("authorization"), process.env.GRAVITY_EXPORT_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant");
  const since = searchParams.get("since");
  if (!tenant) {
    return NextResponse.json({ error: "tenant query param is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
    p_key: `gravity:${tenant}`,
    p_max: EXPORT_API_RATE.limit,
    p_window_seconds: EXPORT_API_RATE.windowSeconds,
  });
  if (rlErr) {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 500 });
  }
  if (allowed === false) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let query = admin
    .from("activity")
    .select("id, tenant_id, actor_id, verb, object_type, object_id, summary, payload, created_at")
    .eq("tenant_id", tenant)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (since) query = query.gt("created_at", since);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logInfo("gravity.export.read", { tenant, since: since ?? "none", count: data.length });

  return NextResponse.json(
    { tenant, since: since ?? null, count: data.length, activity: data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
