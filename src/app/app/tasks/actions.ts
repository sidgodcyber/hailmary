"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, resolveTenant } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { TASK_STATUSES, TASK_ASSIGNEES, type TaskStatus, type TaskAssignee } from "@/lib/config";

function str(fd: FormData, k: string): string {
  return (fd.get(k) ?? "").toString().trim();
}

export async function createTask(formData: FormData) {
  const ctx = await requireAuth();
  const tenant = resolveTenant(ctx, str(formData, "tenant") || null);
  const supabase = await createClient();

  const title = str(formData, "title");
  if (!title) throw new Error("A task title is required.");

  const assignedRaw = str(formData, "assigned_to");
  const assigned_to = (TASK_ASSIGNEES.includes(assignedRaw as TaskAssignee)
    ? assignedRaw
    : "admin") as TaskAssignee;
  const due_date = str(formData, "due_date") || null;

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: tenant.id,
      title,
      details: str(formData, "details"),
      assigned_to,
      due_date,
      status: "open",
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create task.");

  await logActivity(supabase, {
    tenantId: tenant.id,
    actorId: ctx.userId,
    verb: "task.created",
    objectType: "task",
    objectId: data.id,
    summary: `created task “${title}” for ${assigned_to === "admin" ? "the studio" : "the client"}`,
    payload: { id: data.id, title, assigned_to, due_date },
  });

  revalidatePath("/app/tasks");
  revalidatePath("/app/activity");
}

export async function setTaskStatus(taskId: string, status: string) {
  const ctx = await requireAuth();
  const supabase = await createClient();
  if (!TASK_STATUSES.includes(status as TaskStatus)) throw new Error("Invalid status.");

  const { data: task } = await supabase
    .from("tasks")
    .select("id, tenant_id, title")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) throw new Error("Not found.");

  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    tenantId: task.tenant_id,
    actorId: ctx.userId,
    verb: status === "done" ? "task.completed" : "task.status_changed",
    objectType: "task",
    objectId: taskId,
    summary: status === "done" ? `completed task “${task.title}”` : `moved task “${task.title}” to ${status}`,
    payload: { id: taskId, status },
  });

  revalidatePath("/app/tasks");
  revalidatePath("/app/activity");
}
