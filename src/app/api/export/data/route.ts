import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getAuthContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gatherTenantData, toMarkdown, toCsv } from "@/lib/export";
import { logActivity } from "@/lib/activity";
import { displayName } from "@/lib/format";
import { logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-serve data export for the signed-in user's OWN tenant. Unlike the
 * admin export, this uses the RLS-bound client (not the service role), so a
 * client can only ever export their own workspace — RLS enforces it even if
 * the tenant id were tampered with. Each export is logged to the activity feed
 * so the studio sees when a client pulls their data.
 */
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx || !ctx.activeTenant) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const tenantId = ctx.activeTenant.id;
  const data = await gatherTenantData(supabase, tenantId);
  if (!data.tenant) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const zip = new JSZip();
  zip.file("data.json", JSON.stringify(data, null, 2));
  zip.file("summary.md", toMarkdown(data));
  zip.file("csv/ideas.csv", toCsv(data.ideas));
  zip.file("csv/tasks.csv", toCsv(data.tasks));
  zip.file("csv/calendar_entries.csv", toCsv(data.calendar_entries));
  zip.file("csv/comments.csv", toCsv(data.comments));
  zip.file("csv/activity.csv", toCsv(data.activity));
  zip.file("csv/assets.csv", toCsv(data.assets));
  zip.file("csv/attachments.csv", toCsv(data.attachments));

  const buf = await zip.generateAsync({ type: "uint8array" });
  const slug = (data.tenant.slug as string) ?? "workspace";
  const filename = `hailmary-${slug}-${new Date().toISOString().slice(0, 10)}.zip`;

  await logActivity(supabase, {
    tenantId,
    actorId: ctx.userId,
    verb: "data.exported",
    objectType: "tenant",
    objectId: tenantId,
    summary: `${displayName(ctx.fullName, ctx.email)} exported their workspace data`,
    payload: { bytes: buf.byteLength },
  });

  logInfo("client.export", { tenant: tenantId, actor: ctx.userId, bytes: buf.byteLength });

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
