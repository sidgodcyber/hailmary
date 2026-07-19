import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackLink, Badge } from "@/components/ui";
import { StatusControl } from "@/components/ideas/StatusControl";
import { BriefEditor } from "@/components/ideas/BriefEditor";
import { SendToCalendar } from "@/components/ideas/SendToCalendar";
import { CommentThread, type CommentRow } from "@/components/CommentThread";
import { Icon } from "@/components/icons";
import { displayName, formatDateFull, relativeTime } from "@/lib/format";
import { type IdeaStatus } from "@/lib/config";

export default async function IdeaDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const supabase = await createClient();

  const { data: idea } = await supabase
    .from("ideas")
    .select(
      "*, author:profiles!ideas_author_id_fkey(full_name, email), brief_editor:profiles!ideas_brief_updated_by_fkey(full_name, email)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!idea) notFound();

  const { data: commentData } = await supabase
    .from("comments")
    .select("id, body, created_at, author:profiles!comments_author_id_fkey(full_name, email)")
    .eq("parent_type", "idea")
    .eq("parent_id", id)
    .order("created_at", { ascending: true });
  const comments = (commentData ?? []) as unknown as CommentRow[];

  const author = idea.author as { full_name: string | null; email: string } | null;
  const briefEditor = idea.brief_editor as { full_name: string | null; email: string } | null;
  const isRef = idea.type === "reference";

  const briefUpdatedLabel =
    idea.brief_updated_at && briefEditor
      ? `${relativeTime(idea.brief_updated_at)} by ${displayName(briefEditor.full_name, briefEditor.email)}`
      : null;

  return (
    <div className="space-y-5">
      <div>
        <BackLink href="/app/ideas" label="Ideas & briefs" />
        <div className="flex items-center gap-2 mb-2">
          {isRef && <Badge tone="reference">Reference</Badge>}
          <StatusControl ideaId={idea.id} status={idea.status as IdeaStatus} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{idea.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {author ? displayName(author.full_name, author.email) : "Someone"} · {formatDateFull(idea.created_at)}
        </p>
      </div>

      {isRef && (
        <section className="card p-5 space-y-3">
          {idea.ref_url && (
            <a href={idea.ref_url} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1.5">
              <Icon name="link" size={16} /> {idea.ref_url}
            </a>
          )}
          {Array.isArray(idea.ref_like_tags) && idea.ref_like_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {idea.ref_like_tags.map((t: string) => (
                <Badge key={t} tone="reference">
                  <span className="capitalize">{t}</span>
                </Badge>
              ))}
            </div>
          )}
          {idea.ref_likes && (
            <div>
              <p className="label">What we like</p>
              <p className="text-sm whitespace-pre-wrap">{idea.ref_likes}</p>
            </div>
          )}
          {idea.maps_to_product && (
            <div>
              <p className="label">Maps to</p>
              <p className="text-sm">{idea.maps_to_product}</p>
            </div>
          )}
          {idea.ref_notes && (
            <div>
              <p className="label">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{idea.ref_notes}</p>
            </div>
          )}
        </section>
      )}

      {!isRef && idea.body && (
        <section className="card p-5">
          <p className="text-sm whitespace-pre-wrap break-words">{idea.body}</p>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Brief</h2>
        <BriefEditor
          ideaId={idea.id}
          brief={{
            brief_concept: idea.brief_concept,
            brief_hook: idea.brief_hook,
            brief_outline: idea.brief_outline,
            brief_caption: idea.brief_caption,
          }}
          updatedLabel={briefUpdatedLabel}
        />
      </section>

      <SendToCalendar ideaId={idea.id} defaultTitle={idea.title} />

      <CommentThread parentType="idea" parentId={idea.id} comments={comments} />
    </div>
  );
}
