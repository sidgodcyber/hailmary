import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BackLink, Badge } from "@/components/ui";
import { CalendarEditor } from "@/components/calendar/CalendarEditor";
import { ApprovalPanel } from "@/components/calendar/ApprovalPanel";
import { MediaUploader } from "@/components/media/MediaUploader";
import { AttachmentGallery, type AttachmentView } from "@/components/media/AttachmentGallery";
import { CommentThread, type CommentRow } from "@/components/CommentThread";
import { Icon } from "@/components/icons";
import { signMediaUrls } from "@/lib/media";
import {
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_STATUS_LABELS,
  type CalendarChannel,
  type CalendarStatus,
} from "@/lib/config";
import { displayName, formatDateFull, relativeTime } from "@/lib/format";

export default async function CalendarDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireAuth();
  const supabase = await createClient();

  // entry, comments and attachments all key off the route param — one batch.
  const [entryRes, commentRes, attachRes] = await Promise.all([
    supabase
      .from("calendar_entries")
      .select(
        "*, editor:profiles!calendar_entries_updated_by_fkey(full_name, email), creator:profiles!calendar_entries_created_by_fkey(full_name, email), approver:profiles!calendar_entries_approved_by_fkey(full_name, email, global_role)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("comments")
      .select("id, body, created_at, author:profiles!comments_author_id_fkey(full_name, email)")
      .eq("parent_type", "calendar")
      .eq("parent_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("attachments")
      .select("id, tenant_id, kind, storage_path, external_url, title, size_bytes, mime, created_at")
      .eq("parent_type", "calendar")
      .eq("parent_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const entry = entryRes.data;
  if (!entry) notFound();
  const comments = (commentRes.data ?? []) as unknown as CommentRow[];

  // Belt and braces: an admin's RLS spans tenants, so pin attachments to the
  // entry's own tenant rather than trusting parent_id alone.
  const attachmentRows = (attachRes.data ?? []).filter((a) => a.tenant_id === entry.tenant_id);
  const signed = await signMediaUrls(
    supabase,
    attachmentRows.map((a) => a.storage_path).filter((p): p is string => !!p)
  );
  const attachments: AttachmentView[] = attachmentRows.map((a) => ({
    id: a.id,
    kind: a.kind,
    storage_path: a.storage_path,
    external_url: a.external_url,
    title: a.title,
    size_bytes: a.size_bytes ?? 0,
    mime: a.mime,
    created_at: a.created_at,
    signedUrl: a.storage_path ? signed.get(a.storage_path) ?? null : null,
  }));

  const editor = entry.editor as { full_name: string | null; email: string } | null;
  const approver = entry.approver as
    | { full_name: string | null; email: string; global_role: string }
    | null;
  const back = sp.m ? `/app/calendar?m=${sp.m}` : "/app/calendar";
  const hasBrief =
    entry.brief_concept || entry.brief_hook || entry.brief_outline || entry.brief_caption;

  return (
    <div className="space-y-5">
      <div>
        <BackLink href={back} label="Calendar" />
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <Badge tone={entry.channel}>{CALENDAR_CHANNEL_LABELS[entry.channel as CalendarChannel]}</Badge>
          <Badge tone={entry.status === "idea" ? "idea_cal" : entry.status}>
            {CALENDAR_STATUS_LABELS[entry.status as CalendarStatus]}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{entry.title}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {formatDateFull(entry.date)}
          {editor && <> · last edited {relativeTime(entry.updated_at)} by {displayName(editor.full_name, editor.email)}</>}
        </p>
        {entry.linked_idea_id && (
          <Link href={`/app/ideas/${entry.linked_idea_id}`} className="mt-2 inline-flex items-center gap-1 text-sm link">
            <Icon name="link" size={14} /> From a reference brief
          </Link>
        )}
      </div>

      <section className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Draft</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            The actual post — image, video, or a link to the cut.
          </p>
        </div>
        <AttachmentGallery attachments={attachments} />
        <MediaUploader tenantId={entry.tenant_id} parentType="calendar" parentId={entry.id} />
      </section>

      <ApprovalPanel
        entryId={entry.id}
        status={entry.status as CalendarStatus}
        isAdmin={ctx.isAdmin}
        approvedBy={approver ? displayName(approver.full_name, approver.email) : null}
        approvedAt={entry.approved_at ?? null}
        approverIsAdmin={approver?.global_role === "admin"}
        hasMedia={attachments.length > 0}
      />

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Details</h2>
        <CalendarEditor
          entry={{
            id: entry.id,
            title: entry.title,
            date: entry.date,
            channel: entry.channel as CalendarChannel,
            status: entry.status as CalendarStatus,
          }}
        />
      </section>

      {hasBrief && (
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">Brief</h2>
          {entry.brief_concept && (
            <div>
              <p className="label">Concept</p>
              <p className="text-sm whitespace-pre-wrap">{entry.brief_concept}</p>
            </div>
          )}
          {entry.brief_hook && (
            <div>
              <p className="label">Hook</p>
              <p className="text-sm whitespace-pre-wrap">{entry.brief_hook}</p>
            </div>
          )}
          {entry.brief_outline && (
            <div>
              <p className="label">Outline</p>
              <p className="text-sm whitespace-pre-wrap">{entry.brief_outline}</p>
            </div>
          )}
          {entry.brief_caption && (
            <div>
              <p className="label">Caption direction</p>
              <p className="text-sm whitespace-pre-wrap">{entry.brief_caption}</p>
            </div>
          )}
        </section>
      )}

      <CommentThread parentType="calendar" parentId={entry.id} comments={comments} />
    </div>
  );
}
