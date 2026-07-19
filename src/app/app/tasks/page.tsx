import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { NewTaskForm } from "@/components/tasks/NewTaskForm";
import { TaskItem, type Task } from "@/components/tasks/TaskItem";
import { TASK_STATUSES, type TaskStatus } from "@/lib/config";

type Search = { status?: string; who?: string };

const WHO_FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "admin", label: "Studio" },
  { key: "client", label: "Client" },
];
const STATUS_FILTERS = [{ key: "all", label: "All" }, ...TASK_STATUSES.map((s) => ({ key: s, label: s }))];

export default async function TasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant!;
  const supabase = await createClient();

  const statusFilter = TASK_STATUSES.includes(sp.status as TaskStatus) ? sp.status! : "all";
  const whoFilter = sp.who === "admin" || sp.who === "client" ? sp.who : "all";

  let query = supabase
    .from("tasks")
    .select("id, title, details, assigned_to, due_date, status, created_at")
    .eq("tenant_id", tenant.id)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });
  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (whoFilter !== "all") query = query.eq("assigned_to", whoFilter);

  const { data } = await query;
  const tasks = (data ?? []) as Task[];

  const mk = (patch: Partial<Search>) => {
    const params = new URLSearchParams();
    const status = patch.status ?? statusFilter;
    const who = patch.who ?? whoFilter;
    if (status && status !== "all") params.set("status", status);
    if (who && who !== "all") params.set("who", who);
    const s = params.toString();
    return `/app/tasks${s ? `?${s}` : ""}`;
  };

  const chip = (active: boolean) =>
    `chip border capitalize ${active ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-muted border-[color:var(--line)]"}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Tasks" subtitle="What needs doing — for the studio or the client." />

      <NewTaskForm tenantId={tenant.id} />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {WHO_FILTERS.map((f) => (
            <Link key={f.key} href={mk({ who: f.key })} className={chip(whoFilter === f.key)}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <Link key={f.key} href={mk({ status: f.key })} className={chip(statusFilter === f.key)}>
              {f.label.replace("_", " ")}
            </Link>
          ))}
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState title="No tasks here" hint="Add one above — assign it to yourself or the client." />
      ) : (
        <ul className="space-y-2.5">
          {tasks.map((t) => (
            <li key={t.id}>
              <TaskItem task={t} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
