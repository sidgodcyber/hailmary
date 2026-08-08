"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, resolveTenant } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { pathIsInTenant, removeMediaObjects, safeExternalUrl } from "@/lib/media";
import {
  ATTACHMENT_PARENTS,
  MAX_UPLOAD_BYTES,
  type AttachmentKind,
  type AttachmentParent,
} from "@/lib/config";
import { isAttachmentKind } from "@/lib/media.client";

/**
 * Attachments for calendar drafts and idea reference images.
 *
 * SECURITY NOTE — every argument here arrives from the browser and is assumed
 * hostile. In particular `storagePath` is NEVER trusted: the tenant is
 * re-derived from the session via resolveTenant(), and the path must sit under
 * that tenant's own folder. Postgres re-checks the same rule
 * (attachments_path_tenant_scoped, 0005) and storage.objects RLS (0006) checks
 * it again at read/sign time.
 */

const PARENT_TABLE: Record<AttachmentParent, string> = {
  idea: "ideas",
  calendar: "calendar_entries",
};

function isParent(v: string): v is AttachmentParent {
  return (ATTACHMENT_PARENTS as readonly string[]).includes(v);
}

function parentPath(parentType: AttachmentParent, parentId: string): string {
  return parentType === "idea" ? `/app/ideas/${parentId}` : `/app/calendar/${parentId}`;
}

export type RecordAttachmentInput = {
  tenantId: string;
  parentType: string;
  parentId: string;
  kind: string;
  storagePath?: string | null;
  externalUrl?: string | null;
  sizeBytes?: number | null;
  mime?: string | null;
  title?: string | null;
};

export async function recordAttachment(input: RecordAttachmentInput) {
  const ctx = await requireAuth();
  // Throws unless the caller actually belongs to (or admins) this tenant.
  const tenant = resolveTenant(ctx, input.tenantId || null);
  const supabase = await createClient();

  if (!isParent(input.parentType)) throw new Error("Unknown attachment parent.");
  if (!isAttachmentKind(input.kind)) throw new Error("Unknown attachment kind.");
  const parentType = input.parentType;
  const kind = input.kind as AttachmentKind;

  // The parent must exist AND belong to the resolved tenant — otherwise a
  // member of one tenant could hang media off another tenant's post, which an
  // admin (who spans tenants) would then see rendered there.
  const { data: parent } = await supabase
    .from(PARENT_TABLE[parentType])
    .select("id, title")
    .eq("id", input.parentId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!parent) throw new Error("Not found.");

  const title = (input.title ?? "").toString().trim().slice(0, 200) || null;

  let storagePath: string | null = null;
  let externalUrl: string | null = null;
  let sizeBytes = 0;
  let mime: string | null = null;

  if (kind === "drive") {
    externalUrl = safeExternalUrl(input.externalUrl);
    if (!externalUrl) throw new Error("Enter a valid http(s) link.");
  } else {
    storagePath = (input.storagePath ?? "").toString();
    if (!pathIsInTenant(storagePath, tenant.id)) {
      // Either a bug or an attempt to claim another tenant's object.
      throw new Error("That file path is not valid for this workspace.");
    }
    sizeBytes = Math.max(0, Math.floor(Number(input.sizeBytes) || 0));
    if (sizeBytes > MAX_UPLOAD_BYTES) throw new Error("That file is over the 20 MB limit.");
    mime = (input.mime ?? "").toString().slice(0, 100) || null;
  }

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      tenant_id: tenant.id,
      parent_type: parentType,
      parent_id: parent.id,
      kind,
      storage_path: storagePath,
      external_url: externalUrl,
      size_bytes: sizeBytes,
      mime,
      title,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save that attachment.");

  const what = kind === "drive" ? "a video link" : kind === "video" ? "a video" : "an image";
  await logActivity(supabase, {
    tenantId: tenant.id,
    actorId: ctx.userId,
    verb: "attachment.added",
    objectType: "attachment",
    objectId: data.id,
    summary: `attached ${what} to “${parent.title}”`,
    payload: { id: data.id, parentType, parentId: parent.id, kind, sizeBytes },
  });

  revalidatePath(parentPath(parentType, parent.id));
  revalidatePath("/app/activity");
}

export async function deleteAttachment(attachmentId: string) {
  const ctx = await requireAuth();
  const supabase = await createClient();

  // RLS scopes this read, so a cross-tenant id simply comes back empty.
  const { data: row } = await supabase
    .from("attachments")
    .select("id, tenant_id, parent_type, parent_id, kind, storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!row) throw new Error("Not found.");

  const { error } = await supabase.from("attachments").delete().eq("id", attachmentId);
  if (error) throw new Error(error.message);

  // Row is the source of truth; the object is cleaned up best-effort after.
  if (row.storage_path) await removeMediaObjects(supabase, [row.storage_path]);

  await logActivity(supabase, {
    tenantId: row.tenant_id,
    actorId: ctx.userId,
    verb: "attachment.removed",
    objectType: "attachment",
    objectId: attachmentId,
    summary: "removed an attachment",
    payload: { id: attachmentId, parentType: row.parent_type, parentId: row.parent_id },
  });

  if (isParent(row.parent_type)) revalidatePath(parentPath(row.parent_type, row.parent_id));
  revalidatePath("/app/activity");
}

/**
 * Delete an object the browser uploaded but failed to record. Called from the
 * uploader's error path so a half-finished upload doesn't linger in the bucket
 * and quietly eat the storage budget.
 */
export async function discardOrphanUpload(tenantId: string, storagePath: string) {
  const ctx = await requireAuth();
  const tenant = resolveTenant(ctx, tenantId || null);
  if (!pathIsInTenant(storagePath, tenant.id)) return;
  const supabase = await createClient();
  await removeMediaObjects(supabase, [storagePath]);
}
