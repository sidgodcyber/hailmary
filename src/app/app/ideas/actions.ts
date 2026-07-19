"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, resolveTenant } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { displayName } from "@/lib/format";
import {
  IDEA_STATUSES,
  REF_LIKE_TAGS,
  type IdeaStatus,
  type RefLikeTag,
  CALENDAR_CHANNELS,
  type CalendarChannel,
} from "@/lib/config";

function str(fd: FormData, k: string): string {
  return (fd.get(k) ?? "").toString().trim();
}

export async function createIdea(formData: FormData) {
  const ctx = await requireAuth();
  const tenant = resolveTenant(ctx, str(formData, "tenant") || null);
  const supabase = await createClient();

  const type = str(formData, "type") === "reference" ? "reference" : "idea";
  const title = str(formData, "title");
  if (!title) throw new Error("A title is required.");

  const likeTags = REF_LIKE_TAGS.filter((t) => formData.get(`tag_${t}`) === "on") as RefLikeTag[];

  const insert = {
    tenant_id: tenant.id,
    author_id: ctx.userId,
    type,
    title,
    body: str(formData, "body"),
    status: "new" as IdeaStatus,
    ref_url: type === "reference" ? str(formData, "ref_url") || null : null,
    ref_likes: type === "reference" ? str(formData, "ref_likes") || null : null,
    ref_like_tags: type === "reference" ? likeTags : [],
    maps_to_product: type === "reference" ? str(formData, "maps_to_product") || null : null,
    ref_notes: type === "reference" ? str(formData, "ref_notes") || null : null,
  };

  const { data, error } = await supabase.from("ideas").insert(insert).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create.");

  await logActivity(supabase, {
    tenantId: tenant.id,
    actorId: ctx.userId,
    verb: type === "reference" ? "reference.created" : "idea.created",
    objectType: type === "reference" ? "reference" : "idea",
    objectId: data.id,
    summary:
      type === "reference"
        ? `added a reference brief “${title}”`
        : `posted a new idea “${title}”`,
    payload: { ...insert, id: data.id, actor: displayName(ctx.fullName, ctx.email) },
  });

  revalidatePath("/app/ideas");
  revalidatePath("/app/activity");
  redirect(`/app/ideas/${data.id}`);
}

async function loadIdeaTenant(supabase: Awaited<ReturnType<typeof createClient>>, ideaId: string) {
  const { data } = await supabase
    .from("ideas")
    .select("id, tenant_id, title")
    .eq("id", ideaId)
    .maybeSingle();
  return data;
}

export async function updateIdeaStatus(ideaId: string, status: string) {
  const ctx = await requireAuth();
  const supabase = await createClient();
  if (!IDEA_STATUSES.includes(status as IdeaStatus)) throw new Error("Invalid status.");

  const idea = await loadIdeaTenant(supabase, ideaId);
  if (!idea) throw new Error("Not found.");

  const { error } = await supabase.from("ideas").update({ status }).eq("id", ideaId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    tenantId: idea.tenant_id,
    actorId: ctx.userId,
    verb: "idea.status_changed",
    objectType: "idea",
    objectId: ideaId,
    summary: `moved “${idea.title}” to ${status}`,
    payload: { id: ideaId, status },
  });

  revalidatePath(`/app/ideas/${ideaId}`);
  revalidatePath("/app/ideas");
  revalidatePath("/app/activity");
}

export async function updateBrief(ideaId: string, formData: FormData) {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const idea = await loadIdeaTenant(supabase, ideaId);
  if (!idea) throw new Error("Not found.");

  const patch = {
    brief_concept: str(formData, "brief_concept") || null,
    brief_hook: str(formData, "brief_hook") || null,
    brief_outline: str(formData, "brief_outline") || null,
    brief_caption: str(formData, "brief_caption") || null,
    brief_updated_at: new Date().toISOString(),
    brief_updated_by: ctx.userId,
  };

  const { error } = await supabase.from("ideas").update(patch).eq("id", ideaId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    tenantId: idea.tenant_id,
    actorId: ctx.userId,
    verb: "brief.updated",
    objectType: "brief",
    objectId: ideaId,
    summary: `updated the brief for “${idea.title}”`,
    payload: { id: ideaId, ...patch },
  });

  revalidatePath(`/app/ideas/${ideaId}`);
  revalidatePath("/app/activity");
}

export async function addComment(parentType: "idea" | "calendar", parentId: string, formData: FormData) {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const body = str(formData, "body");
  if (!body) return;

  // resolve tenant from the parent row (RLS scoped)
  const table = parentType === "idea" ? "ideas" : "calendar_entries";
  const { data: parent } = await supabase
    .from(table)
    .select("tenant_id, title")
    .eq("id", parentId)
    .maybeSingle();
  if (!parent) throw new Error("Not found.");

  const { error } = await supabase.from("comments").insert({
    tenant_id: parent.tenant_id,
    parent_type: parentType,
    parent_id: parentId,
    author_id: ctx.userId,
    body,
  });
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    tenantId: parent.tenant_id,
    actorId: ctx.userId,
    verb: "comment.created",
    objectType: "comment",
    objectId: parentId,
    summary: `commented on “${parent.title}”`,
    payload: { parentType, parentId },
  });

  revalidatePath(`/app/${parentType === "idea" ? "ideas" : "calendar"}/${parentId}`);
  revalidatePath("/app/activity");
}

export async function sendToCalendar(ideaId: string, formData: FormData) {
  const ctx = await requireAuth();
  const supabase = await createClient();

  const { data: idea } = await supabase
    .from("ideas")
    .select("id, tenant_id, title, brief_concept, brief_hook, brief_outline, brief_caption")
    .eq("id", ideaId)
    .maybeSingle();
  if (!idea) throw new Error("Not found.");

  const channelRaw = str(formData, "channel");
  const channel = (CALENDAR_CHANNELS.includes(channelRaw as CalendarChannel)
    ? channelRaw
    : "instagram") as CalendarChannel;
  const date = str(formData, "date") || new Date().toISOString().slice(0, 10);
  const title = str(formData, "title") || idea.title;

  const { data: entry, error } = await supabase
    .from("calendar_entries")
    .insert({
      tenant_id: idea.tenant_id,
      title,
      date,
      channel,
      status: "idea",
      linked_idea_id: idea.id,
      brief_concept: idea.brief_concept,
      brief_hook: idea.brief_hook,
      brief_outline: idea.brief_outline,
      brief_caption: idea.brief_caption,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !entry) throw new Error(error?.message ?? "Could not create entry.");

  await logActivity(supabase, {
    tenantId: idea.tenant_id,
    actorId: ctx.userId,
    verb: "brief.sent_to_calendar",
    objectType: "calendar",
    objectId: entry.id,
    summary: `sent “${title}” to the calendar (${date})`,
    payload: { calendarEntryId: entry.id, fromIdea: idea.id, date, channel },
  });

  revalidatePath(`/app/ideas/${ideaId}`);
  revalidatePath("/app/calendar");
  revalidatePath("/app/activity");
  redirect(`/app/calendar/${entry.id}`);
}
