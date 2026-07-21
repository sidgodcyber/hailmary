import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/ui";
import { Icon } from "@/components/icons";
import { InviteClientForm } from "@/components/admin/InviteClientForm";
import { OpenWorkspaceButton } from "@/components/admin/OpenWorkspaceButton";
import { displayName } from "@/lib/format";

type Member = {
  role: string;
  profiles: { email: string; full_name: string | null; global_role: string } | null;
};

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  tenantId: string
): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return count ?? 0;
}

export default async function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const supabase = await createClient();

  // tenant row, members and all counts key off the route param — one batch.
  const [tenantRes, memberRes, ideas, tasks, calendar, activity] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", id).maybeSingle(),
    supabase.from("memberships").select("role, profiles(email, full_name, global_role)").eq("tenant_id", id),
    count(supabase, "ideas", id),
    count(supabase, "tasks", id),
    count(supabase, "calendar_entries", id),
    count(supabase, "activity", id),
  ]);

  const tenant = tenantRes.data;
  if (!tenant) notFound();
  const members = (memberRes.data ?? []) as unknown as Member[];

  const stats = [
    { label: "Ideas", value: ideas },
    { label: "Tasks", value: tasks },
    { label: "Calendar", value: calendar },
    { label: "Activity", value: activity },
  ];

  return (
    <div className="space-y-5">
      <div>
        <BackLink href="/admin" label="Admin" />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <OpenWorkspaceButton tenantId={tenant.id} />
        </div>
        <p className="mt-0.5 text-sm text-ink-muted">/{tenant.slug}</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs text-ink-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Members</h2>
        {members.length === 0 ? (
          <p className="text-sm text-ink-muted">No client login linked yet — invite one below.</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-800 text-xs font-bold">
                  {(m.profiles?.email ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="font-medium">
                  {m.profiles ? displayName(m.profiles.full_name, m.profiles.email) : "Unknown"}
                </span>
                <span className="text-ink-muted">{m.profiles?.email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Invite a client login</h2>
        <InviteClientForm tenantId={tenant.id} />
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-1">Export all data</h2>
        <p className="text-sm text-ink-muted mb-3">
          Download this client&apos;s full workspace (JSON + Markdown + CSVs). Admin only.
        </p>
        <a href={`/api/admin/export/${tenant.id}`} className="btn-accent">
          <Icon name="download" size={16} /> Export {tenant.name}
        </a>
      </section>
    </div>
  );
}
