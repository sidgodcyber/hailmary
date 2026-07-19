import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { ActivityFeed, type ActivityRow } from "@/components/ActivityFeed";
import { displayName } from "@/lib/format";

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
  const { data } = await supabase
    .from("activity")
    .select("id, verb, object_type, summary, created_at, actor:profiles!activity_actor_id_fkey(full_name, email)")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const rows = (data ?? []) as unknown as ActivityRow[];
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
