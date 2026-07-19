import { Avatar } from "@/components/ui";
import { displayName, relativeTime, formatDateTime } from "@/lib/format";

export type ActivityRow = {
  id: string;
  verb: string;
  object_type: string;
  summary: string;
  created_at: string;
  actor: { full_name: string | null; email: string } | null;
};

export function ActivityFeed({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-ink-muted">No activity yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const who = r.actor ? displayName(r.actor.full_name, r.actor.email) : "System";
        return (
          <li key={r.id} className="flex items-start gap-3">
            <Avatar label={who} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">
                <span className="font-semibold">{who}</span>{" "}
                <span className="text-ink">{r.summary}</span>
              </p>
              <p className="text-xs text-ink-muted" title={formatDateTime(r.created_at)}>
                {relativeTime(r.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
