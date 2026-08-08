import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { NewAssetForm } from "@/components/assets/NewAssetForm";
import { AssetItem, type Asset } from "@/components/assets/AssetItem";
import { ASSET_STATUSES, ASSET_STATUS_LABELS } from "@/lib/config";

export default async function AssetsPage() {
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant!;
  const supabase = await createClient();

  const [assetsRes, calRes] = await Promise.all([
    supabase
      .from("assets")
      .select("id, label, drive_url, status, note, linked_calendar_entry_id, updated_at, created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("calendar_entries")
      .select("id, title, date")
      .eq("tenant_id", tenant.id)
      .order("date", { ascending: false }),
  ]);

  const assets = (assetsRes.data ?? []) as Asset[];
  const calendarEntries = (calRes.data ?? []) as { id: string; title: string; date: string }[];

  const byStatus = new Map<string, Asset[]>();
  for (const a of assets) {
    const list = byStatus.get(a.status) ?? [];
    list.push(a);
    byStatus.set(a.status, list);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Raw assets"
        subtitle="Track footage from handoff to posted — new → downloaded → editing → edited → used."
      />

      <NewAssetForm tenantId={tenant.id} />

      {assets.length === 0 ? (
        <EmptyState title="No footage yet" hint="Add a Google Drive link above to start tracking it." />
      ) : (
        <div className="space-y-6">
          {ASSET_STATUSES.map((status) => {
            const list = byStatus.get(status) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={status}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={`asset_${status}`}>{ASSET_STATUS_LABELS[status]}</Badge>
                  <span className="text-xs text-ink-muted">{list.length}</span>
                </div>
                <ul className="space-y-2.5">
                  {list.map((a) => (
                    <li key={a.id}>
                      <AssetItem asset={a} calendarEntries={calendarEntries} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
