import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Avatar, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { CreateTenantForm } from "@/components/admin/CreateTenantForm";
import { CALENDAR_PENDING_STATUSES, CALENDAR_STATUS_LABELS, type CalendarStatus } from "@/lib/config";
import { displayName, relativeTime, formatDate, formatDateTime } from "@/lib/format";

type CombinedActivity = {
  id: string;
  summary: string;
  created_at: string;
  tenant: { name: string } | null;
  actor: { full_name: string | null; email: string } | null;
};

type PendingEntry = {
  id: string;
  title: string;
  date: string;
  status: string;
  tenant: { name: string } | null;
};

export default async function AdminHome() {
  await requireAdmin();
  const supabase = await createClient();

  // tenant list, cross-tenant activity, and everything mid-approval — one batch.
  const [tenantRes, activityRes, pendingRes] = await Promise.all([
    supabase.from("tenants").select("id, name, slug").order("name"),
    supabase
      .from("activity")
      .select("id, summary, created_at, tenant:tenants(name), actor:profiles!activity_actor_id_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("calendar_entries")
      .select("id, title, date, status, tenant:tenants(name)")
      .in("status", CALENDAR_PENDING_STATUSES)
      .order("date", { ascending: true }),
  ]);

  const tenants = tenantRes.data ?? [];
  const activity = (activityRes.data ?? []) as unknown as CombinedActivity[];
  const pending = (pendingRes.data ?? []) as unknown as PendingEntry[];

  return (
    <div className="space-y-5">
      <PageHeader title="Admin" subtitle="Manage clients, invite logins, and see everything at a glance." />

      {pending.length > 0 && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 font-semibold mb-3">
            <Icon name="clock" size={18} /> In the approval loop — {pending.length}
          </h2>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/app/calendar/${p.id}`}
                  className="flex items-center gap-2 rounded-xl border border-[color:var(--line)] px-3 py-2.5 text-sm hover:bg-cream/60"
                >
                  <Badge tone={p.status}>{CALENDAR_STATUS_LABELS[p.status as CalendarStatus]}</Badge>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {p.tenant?.name ?? "—"} · {formatDate(p.date)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Opening one switches you into that client&apos;s workspace view.
          </p>
        </section>
      )}

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
