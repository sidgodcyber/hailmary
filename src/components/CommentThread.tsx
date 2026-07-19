import { Avatar } from "@/components/ui";
import { CommentForm } from "@/components/CommentForm";
import { displayName, relativeTime, formatDateTime } from "@/lib/format";

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string | null; email: string } | null;
};

export function CommentThread({
  parentType,
  parentId,
  comments,
}: {
  parentType: "idea" | "calendar";
  parentId: string;
  comments: CommentRow[];
}) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-4">Discussion</h2>
      {comments.length === 0 ? (
        <p className="text-sm text-ink-muted mb-4">No comments yet — start the conversation.</p>
      ) : (
        <ul className="space-y-4 mb-4">
          {comments.map((c) => {
            const who = c.author ? displayName(c.author.full_name, c.author.email) : "Someone";
            return (
              <li key={c.id} className="flex items-start gap-3">
                <Avatar label={who} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{who}</span>{" "}
                    <span className="text-ink-muted text-xs" title={formatDateTime(c.created_at)}>
                      · {relativeTime(c.created_at)}
                    </span>
                  </p>
                  <p className="text-sm text-ink whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <CommentForm parentType={parentType} parentId={parentId} />
    </section>
  );
}
