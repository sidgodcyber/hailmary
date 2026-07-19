"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, resolveTenant } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { formatDate } from "@/lib/format";
import {
  CALENDAR_CHANNELS,
  CALENDAR_STATUSES,
  type CalendarChannel,
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
  const statusRaw = str(formData, "status");
  const status = (CALENDAR_STATUSES.includes(statusRaw as CalendarStatus)
    ? statusRaw
    : before.status) as CalendarStatus;

  const patch: Record<string, unknown> = { title, date, status, updated_by: ctx.userId };
  if (channel) patch.channel = channel;

  const { error } = await supabase.from("calendar_entries").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  let verb = "calendar.updated";
  let summary = `updated “${title}”`;
  if (date !== before.date) {
    verb = "calendar.moved";
    summary = `moved “${title}” to ${formatDate(date)}`;
  } else if (status !== before.status) {
    verb = "calendar.status_changed";
    summary = `marked “${title}” as ${status}`;
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
