import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { gatherTenantData, toMarkdown, toCsv } from "@/lib/export";
import { logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only full data export for one tenant. There is NO client-facing export.
 * Requires an admin session (verified via the RLS-bound context); a client
 * hitting this gets 403. Uses the service role to assemble the bundle AFTER the
 * admin check, and scopes every query by tenant id.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> }
) {
  const { tenant } = await params;
  const ctx = await getAuthContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const data = await gatherTenantData(admin, tenant);
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
  const slug = (data.tenant.slug as string) ?? "tenant";
  const filename = `hailmary-${slug}-${new Date().toISOString().slice(0, 10)}.zip`;

  logInfo("admin.export", { tenant, actor: ctx.userId, bytes: buf.byteLength });

  // Uint8Array is a valid Response body at runtime; cast around TS 5.7's
  // generic-typed-array vs BodyInit friction.
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
