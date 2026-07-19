import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { IDEA_STATUS_LABELS, IDEA_STATUSES, type IdeaStatus } from "@/lib/config";
import { relativeTime } from "@/lib/format";

type Search = { type?: string; status?: string };

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "idea", label: "Ideas" },
  { key: "reference", label: "References" },
];

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant!;
  const supabase = await createClient();

  const typeFilter = sp.type === "idea" || sp.type === "reference" ? sp.type : "all";
  const statusFilter = IDEA_STATUSES.includes(sp.status as IdeaStatus) ? sp.status : null;

  let query = supabase
    .from("ideas")
    .select("id, type, title, body, status, updated_at, ref_url")
    .eq("tenant_id", tenant.id)
    .order("updated_at", { ascending: false });
  if (typeFilter !== "all") query = query.eq("type", typeFilter);
  if (statusFilter) query = query.eq("status", statusFilter);

  const { data } = await query;
  const ideas = data ?? [];

  const mk = (patch: Partial<Search>) => {
    const params = new URLSearchParams();
    const type = patch.type ?? typeFilter;
    const status = patch.status ?? statusFilter ?? "";
    if (type && type !== "all") params.set("type", type);
    if (status) params.set("status", status);
    const s = params.toString();
    return `/app/ideas${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ideas & briefs"
        subtitle="Brainstorm, drop references, and shape them into briefs together."
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/app/ideas/new" className="btn-primary">
          <Icon name="plus" size={16} /> New idea
        </Link>
        <Link href="/app/ideas/new?type=reference" className="btn-ghost">
          <Icon name="link" size={16} /> Add reference
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={mk({ type: f.key })}
            className={`chip border ${
              typeFilter === f.key
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-ink-muted border-[color:var(--line)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 h-4 w-px bg-[color:var(--line)]" />
        <Link
          href={mk({ status: "" })}
          className={`chip border ${
            !statusFilter
              ? "bg-ink text-white border-ink"
              : "bg-white text-ink-muted border-[color:var(--line)]"
          }`}
        >
          Any status
        </Link>
        {IDEA_STATUSES.map((s) => (
          <Link
            key={s}
            href={mk({ status: s })}
            className={`chip border ${
              statusFilter === s
                ? "bg-ink text-white border-ink"
                : "bg-white text-ink-muted border-[color:var(--line)]"
            }`}
          >
            {IDEA_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {ideas.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          hint="Post an idea or paste a reference reel/post to get started."
        />
      ) : (
        <ul className="space-y-2.5">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Link href={`/app/ideas/${idea.id}`} className="card block p-4 hover:shadow-soft transition-shadow">
                <div className="flex items-center gap-2 mb-1.5">
                  {idea.type === "reference" && <Badge tone="reference">Reference</Badge>}
                  <Badge tone={idea.status}>{IDEA_STATUS_LABELS[idea.status as IdeaStatus]}</Badge>
                  <span className="ml-auto text-xs text-ink-muted">{relativeTime(idea.updated_at)}</span>
                </div>
                <p className="font-semibold leading-snug">{idea.title}</p>
                {idea.type === "reference" && idea.ref_url ? (
                  <p className="mt-0.5 text-sm text-brand-700 truncate">{idea.ref_url}</p>
                ) : (
                  idea.body && <p className="mt-0.5 text-sm text-ink-muted line-clamp-2">{idea.body}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
