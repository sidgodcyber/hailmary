"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, resolveTenant } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { formatDate } from "@/lib/format";
import {
  CALENDAR_CHANNELS,
  CALENDAR_MANUAL_STATUSES,
  CALENDAR_STATUS_LABELS,
  type CalendarChannel,
  type CalendarManualStatus,
  type CalendarStatus,
} from "@/lib/config";

function str(fd: FormData, k: string): string {
  return (fd.get(k) ?? "").toString().trim();
}

export async function createCalendarEntry(formData: FormData) {
  const ctx = await requireAuth();
  const tenant = resolveTenant(ctx, str(formData, "tenant") || null);
  const supabase = await createClient();

  const title = str(formData, "title");
  if (!title) throw new Error("A title is required.");
  const date = str(formData, "date") || new Date().toISOString().slice(0, 10);
  const channelRaw = str(formData, "channel");
  const channel = (CALENDAR_CHANNELS.includes(channelRaw as CalendarChannel)
    ? channelRaw
    : "instagram") as CalendarChannel;

  const { data, error } = await supabase
    .from("calendar_entries")
    .insert({
      tenant_id: tenant.id,
      title,
      date,
      channel,
      status: "idea",
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create entry.");

  await logActivity(supabase, {
    tenantId: tenant.id,
    actorId: ctx.userId,
    verb: "calendar.created",
    objectType: "calendar",
    objectId: data.id,
    summary: `added “${title}” to the calendar (${formatDate(date)})`,
    payload: { id: data.id, title, date, channel },
  });

  revalidatePath("/app/calendar");
  revalidatePath("/app/activity");
  redirect(`/app/calendar/${data.id}?m=${date.slice(0, 7)}`);
}

export async function updateCalendarEntry(id: string, formData: FormData) {
  const ctx = await requireAuth();
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("calendar_entries")
    .select("id, tenant_id, title, date, status")
    .eq("id", id)
    .maybeSingle();
  if (!before) throw new Error("Not found.");

  const title = str(formData, "title") || before.title;
  const date = str(formData, "date") || before.date;
  const channelRaw = str(formData, "channel");
  const channel = (CALENDAR_CHANNELS.includes(channelRaw as CalendarChannel)
    ? channelRaw
    : undefined) as CalendarChannel | undefined;
  // Only idea/drafted/posted are settable here. awaiting_approval, approved and
  // changes_requested are reachable ONLY through the approval actions below, so
  // "Approved" on a post always means someone actually pressed approve.
  const statusRaw = str(formData, "status");
  let status = before.status as string;
  if (statusRaw && statusRaw !== before.status) {
    if (!(CALENDAR_MANUAL_STATUSES as readonly string[]).includes(statusRaw)) {
      throw new Error("That status is set through the approval flow, not here.");
    }
    status = statusRaw as CalendarManualStatus;
  }

  const patch: Record<string, unknown> = { title, date, status, updated_by: ctx.userId };
  if (channel) patch.channel = channel;
  // Pulling a post back out of the approval loop retires the old sign-off.
  if (status !== before.status) {
    patch.approved_by = null;
    patch.approved_at = null;
  }

  const { error } = await supabase.from("calendar_entries").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  let verb = "calendar.updated";
  let summary = `updated “${title}”`;
  if (date !== before.date) {
    verb = "calendar.moved";
    summary = `moved “${title}” to ${formatDate(date)}`;
  } else if (status !== before.status) {
    verb = "calendar.status_changed";
    summary = `marked “${title}” as ${CALENDAR_STATUS_LABELS[status as CalendarStatus]}`;
  }

  await logActivity(supabase, {
    tenantId: before.tenant_id,
    actorId: ctx.userId,
    verb,
    objectType: "calendar",
    objectId: id,
    summary,
    payload: { id, title, date, status, channel: channel ?? null },
  });

  revalidatePath("/app/calendar");
  revalidatePath(`/app/calendar/${id}`);
  revalidatePath("/app/activity");
}

// ---------------------------------------------------------------------------
// Approval loop:  drafted → awaiting_approval → approved | changes_requested
//
// The client is the one whose approval means something, so `approved_by` always
// records the human who actually pressed the button. An admin can still record
// an approval that arrived over WhatsApp — it is logged and labelled as being
// on the client's behalf rather than being passed off as the client's own click.
// ---------------------------------------------------------------------------

async function loadEntry(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  // RLS-scoped: an id from another tenant simply comes back empty.
  const { data } = await supabase
    .from("calendar_entries")
    .select("id, tenant_id, title, status")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error("Not found.");
  return data;
}

function revalidateEntry(id: string) {
  revalidatePath("/app");
  revalidatePath("/app/calendar");
  revalidatePath(`/app/calendar/${id}`);
  revalidatePath("/app/activity");
  revalidatePath("/admin");
}

/** Studio-side: hand a draft to the client for sign-off. */
export async function submitForApproval(entryId: string) {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const entry = await loadEntry(supabase, entryId);

  const { error } = await supabase
    .from("calendar_entries")
    .update({
      status: "awaiting_approval",
      approved_by: null,
      approved_at: null,
      updated_by: ctx.userId,
    })
    .eq("id", entryId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    tenantId: entry.tenant_id,
    actorId: ctx.userId,
    verb: "calendar.submitted_for_approval",
    objectType: "calendar",
    objectId: entryId,
    summary: `sent “${entry.title}” for approval`,
    payload: { id: entryId, status: "awaiting_approval" },
  });

  revalidateEntry(entryId);
}

/** Client-side sign-off (or an admin recording one that came in elsewhere). */
export async function approveEntry(entryId: string) {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const entry = await loadEntry(supabase, entryId);

  const { error } = await supabase
    .from("calendar_entries")
    .update({
      status: "approved",
      approved_by: ctx.userId,
      approved_at: new Date().toISOString(),
      updated_by: ctx.userId,
    })
    .eq("id", entryId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    tenantId: entry.tenant_id,
    actorId: ctx.userId,
    verb: "calendar.approved",
    objectType: "calendar",
    objectId: entryId,
    summary: ctx.isAdmin
      ? `recorded the client's approval of “${entry.title}”`
      : `approved “${entry.title}” ✅`,
    payload: { id: entryId, status: "approved", onBehalf: ctx.isAdmin },
  });

  revalidateEntry(entryId);
}

/** Client-side "not yet" — the reason goes into the existing comment thread. */
export async function requestChanges(entryId: string, formData: FormData) {
  const ctx = await requireAuth();
  const supabase = await createClient();
  const entry = await loadEntry(supabase, entryId);

  const note = str(formData, "body");
  if (!note) throw new Error("Tell them what to change.");

  const { error } = await supabase
    .from("calendar_entries")
    .update({
      status: "changes_requested",
      approved_by: null,
      approved_at: null,
      updated_by: ctx.userId,
    })
    .eq("id", entryId);
  if (error) throw new Error(error.message);

  // The reason lives in the normal discussion thread, so nothing is hidden in
  // a side channel the other party has to go looking for.
  const { error: commentError } = await supabase.from("comments").insert({
    tenant_id: entry.tenant_id,
    parent_type: "calendar",
    parent_id: entryId,
    author_id: ctx.userId,
    body: note,
  });
  if (commentError) throw new Error(commentError.message);

  await logActivity(supabase, {
    tenantId: entry.tenant_id,
    actorId: ctx.userId,
    verb: "calendar.changes_requested",
    objectType: "calendar",
    objectId: entryId,
    summary: ctx.isAdmin
      ? `logged a change request on “${entry.title}”`
      : `asked for changes on “${entry.title}”`,
    payload: { id: entryId, status: "changes_requested", onBehalf: ctx.isAdmin },
  });

  revalidateEntry(entryId);
}
