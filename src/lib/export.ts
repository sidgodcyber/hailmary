import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Gather ALL of one tenant's data and render it as a JSON blob, a human
 * Markdown summary, and per-table CSVs. Used by the admin-only export route.
 * The caller MUST verify the requester is an admin before calling this.
 */

export type TenantExport = {
  tenant: Record<string, unknown> | null;
  members: Record<string, unknown>[];
  ideas: Record<string, unknown>[];
  comments: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  calendar_entries: Record<string, unknown>[];
  activity: Record<string, unknown>[];
  exported_at: string;
};

export async function gatherTenantData(
  db: SupabaseClient,
  tenantId: string
): Promise<TenantExport> {
  const [tenant, members, ideas, comments, tasks, calendar, activity] = await Promise.all([
    db.from("tenants").select("*").eq("id", tenantId).maybeSingle(),
    db.from("memberships").select("*, profiles(email, full_name, global_role)").eq("tenant_id", tenantId),
    db.from("ideas").select("*").eq("tenant_id", tenantId).order("created_at"),
    db.from("comments").select("*").eq("tenant_id", tenantId).order("created_at"),
    db.from("tasks").select("*").eq("tenant_id", tenantId).order("created_at"),
    db.from("calendar_entries").select("*").eq("tenant_id", tenantId).order("date"),
    db.from("activity").select("*").eq("tenant_id", tenantId).order("created_at"),
  ]);

  return {
    tenant: tenant.data ?? null,
    members: members.data ?? [],
    ideas: ideas.data ?? [],
    comments: comments.data ?? [],
    tasks: tasks.data ?? [],
    calendar_entries: calendar.data ?? [],
    activity: activity.data ?? [],
    exported_at: new Date().toISOString(),
  };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("|") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]!);
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

export function toMarkdown(data: TenantExport): string {
  const name = (data.tenant?.name as string) ?? "Tenant";
  const lines: string[] = [];
  lines.push(`# ${name} — data export`);
  lines.push("");
  lines.push(`_Exported ${data.exported_at}_`);
  lines.push("");
  lines.push(
    `Ideas & references: ${data.ideas.length} · Tasks: ${data.tasks.length} · ` +
      `Calendar entries: ${data.calendar_entries.length} · Comments: ${data.comments.length} · ` +
      `Activity: ${data.activity.length}`
  );

  lines.push("\n## Ideas & reference briefs\n");
  for (const i of data.ideas) {
    lines.push(`### ${i.title} _(${i.type}, ${i.status})_`);
    if (i.ref_url) lines.push(`- Link: ${i.ref_url}`);
    if (i.body) lines.push(`\n${i.body}\n`);
    if (i.ref_likes) lines.push(`- What we like: ${i.ref_likes}`);
    if (i.maps_to_product) lines.push(`- Maps to: ${i.maps_to_product}`);
    const brief = [i.brief_concept, i.brief_hook, i.brief_outline, i.brief_caption].filter(Boolean);
    if (brief.length) {
      lines.push(`\n**Brief**`);
      if (i.brief_concept) lines.push(`- Concept: ${i.brief_concept}`);
      if (i.brief_hook) lines.push(`- Hook: ${i.brief_hook}`);
      if (i.brief_outline) lines.push(`- Outline: ${i.brief_outline}`);
      if (i.brief_caption) lines.push(`- Caption: ${i.brief_caption}`);
    }
    lines.push("");
  }

  lines.push("\n## Tasks\n");
  for (const t of data.tasks) {
    lines.push(`- [${t.status === "done" ? "x" : " "}] ${t.title} — ${t.assigned_to}${t.due_date ? `, due ${t.due_date}` : ""}`);
  }

  lines.push("\n## Content calendar\n");
  for (const c of data.calendar_entries) {
    lines.push(`- ${c.date} · ${c.channel} · ${c.status} — ${c.title}`);
  }

  return lines.join("\n") + "\n";
}
