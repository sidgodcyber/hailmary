import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Avatar } from "@/components/ui";
import { Icon } from "@/components/icons";
import { CreateTenantForm } from "@/components/admin/CreateTenantForm";
import { displayName, relativeTime, formatDateTime } from "@/lib/format";

type CombinedActivity = {
  id: string;
  summary: string;
  created_at: string;
  tenant: { name: string } | null;
  actor: { full_name: string | null; email: string } | null;
};

export default async function AdminHome() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: tenantData } = await supabase.from("tenants").select("id, name, slug").order("name");
  const tenants = tenantData ?? [];

  const { data: activityData } = await supabase
    .from("activity")
    .select("id, summary, created_at, tenant:tenants(name), actor:profiles!activity_actor_id_fkey(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(30);
  const activity = (activityData ?? []) as unknown as CombinedActivity[];

  return (
    <div className="space-y-5">
      <PageHeader title="Admin" subtitle="Manage clients, invite logins, and see everything at a glance." />

      <CreateTenantForm />

      <section>
        <h2 className="font-semibold mb-2">Clients</h2>
        {tenants.length === 0 ? (
          <EmptyState title="No clients yet" hint="Add your first client above." />
        ) : (
          <ul className="space-y-2">
            {tenants.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/tenants/${t.id}`}
                  className="card flex items-center gap-3 p-4 hover:shadow-soft transition-shadow"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-800 font-bold">
                    {t.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{t.name}</p>
                    <p className="text-xs text-ink-muted">/{t.slug}</p>
                  </div>
                  <Icon name="back" size={16} className="rotate-180 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-4">Recent activity — all clients</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => {
              const who = a.actor ? displayName(a.actor.full_name, a.actor.email) : "System";
              return (
                <li key={a.id} className="flex items-start gap-3">
                  <Avatar label={who} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-semibold">{who}</span> {a.summary}
                    </p>
                    <p className="text-xs text-ink-muted" title={formatDateTime(a.created_at)}>
                      {a.tenant?.name ?? "—"} · {relativeTime(a.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
