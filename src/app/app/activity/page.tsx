import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ActivityFeed, type ActivityRow } from "@/components/ActivityFeed";

export default async function ActivityPage() {
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant!;
  const supabase = await createClient();

  const { data } = await supabase
    .from("activity")
    .select("id, verb, object_type, summary, created_at, actor:profiles!activity_actor_id_fkey(full_name, email)")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as ActivityRow[];

  return (
    <div className="space-y-4">
      <PageHeader title="Activity" subtitle="Everything that's happened in this workspace, newest first." />
      <section className="card p-5">
        <ActivityFeed rows={rows} />
      </section>
    </div>
  );
}
