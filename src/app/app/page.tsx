import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { ActivityFeed, type ActivityRow } from "@/components/ActivityFeed";
import { CALENDAR_PENDING_STATUSES } from "@/lib/config";
import { displayName, formatDate } from "@/lib/format";

type PendingEntry = { id: string; title: string; date: string; status: string };

const QUICK = [
  { href: "/app/ideas", label: "Ideas & briefs", icon: "idea" as const, hint: "Brainstorm & references" },
  { href: "/app/tasks", label: "Tasks", icon: "task" as const, hint: "What needs doing" },
  { href: "/app/calendar", label: "Calendar", icon: "calendar" as const, hint: "Plan your posts" },
  { href: "/app/activity", label: "Activity", icon: "activity" as const, hint: "Everything recent" },
];

export default async function Dashboard() {
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant;
  if (!tenant) return null;

  const supabase = await createClient();
  const [activityRes, pendingRes] = await Promise.all([
    supabase
      .from("activity")
      .select("id, verb, object_type, summary, created_at, actor:profiles!activity_actor_id_fkey(full_name, email)")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("calendar_entries")
      .select("id, title, date, status")
      .eq("tenant_id", tenant.id)
      .in("status", CALENDAR_PENDING_STATUSES)
      .order("date", { ascending: true }),
  ]);

  const rows = (activityRes.data ?? []) as unknown as ActivityRow[];
  const pending = (pendingRes.data ?? []) as PendingEntry[];
  const awaiting = pending.filter((p) => p.status === "awaiting_approval");
  const changesRequested = pending.filter((p) => p.status === "changes_requested");
  const first = displayName(ctx.fullName, ctx.email).split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hi {first} 👋</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {ctx.isAdmin ? `You're viewing ` : `Welcome to `}
          <span className="font-medium text-ink">{tenant.name}</span>
          {ctx.isAdmin ? "." : "'s workspace."}
        </p>
      </div>

      {awaiting.length > 0 && (
        <section className="card border-accent-200 bg-accent-50/60 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon name="clock" size={18} />
            {ctx.isAdmin
              ? `Waiting on the client — ${awaiting.length}`
              : awaiting.length === 1
              ? "1 draft needs your approval"
              : `${awaiting.length} drafts need your approval`}
          </h2>
          <ul className="mt-3 space-y-2">
            {awaiting.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/app/calendar/${e.id}`}
                  className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-sm hover:shadow-soft transition-shadow"
                >
                  <span className="w-12 shrink-0 font-semibold tabular-nums text-ink-muted">
                    {formatDate(e.date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
                  <Icon name="arrowRight" size={16} className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {changesRequested.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">
            {ctx.isAdmin ? "Changes requested by the client" : "Changes you asked for"}
          </h2>
          <ul className="mt-3 space-y-2">
            {changesRequested.map((e) => (
              <li key={e.id}>
                <Link href={`/app/calendar/${e.id}`} className="flex items-center gap-2 text-sm link">
                  <span className="tabular-nums">{formatDate(e.date)}</span>
                  <span className="truncate">{e.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="card p-4 hover:shadow-soft transition-shadow">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={q.icon} size={20} />
            </span>
            <p className="mt-3 font-semibold leading-tight">{q.label}</p>
            <p className="text-xs text-ink-muted">{q.hint}</p>
          </Link>
        ))}
      </div>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent activity</h2>
          <Link href="/app/activity" className="text-sm link">
            See all
          </Link>
        </div>
        <ActivityFeed rows={rows} />
      </section>
    </div>
  );
}
