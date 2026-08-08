"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, resolveTenant } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { ASSET_STATUSES, ASSET_STATUS_LABELS, type AssetStatus } from "@/lib/config";

function str(fd: FormData, k: string): string {
  return (fd.get(k) ?? "").toString().trim();
}

export async function createAsset(formData: FormData) {
  const ctx = await requireAuth();
  const tenant = resolveTenant(ctx, str(formData, "tenant") || null);
  const supabase = await createClient();

  const label = str(formData, "label");
  if (!label) throw new Error("A label is required.");

  const { data, error } = await supabase
    .from("assets")
    .insert({
      tenant_id: tenant.id,
      label,
      drive_url: str(formData, "drive_url") || null,
      status: "new",
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not add asset.");

  await logActivity(supabase, {
    tenantId: tenant.id,
    actorId: ctx.userId,
    verb: "asset.created",
    objectType: "asset",
    objectId: data.id,
    summary: `added footage “${label}”`,
    payload: { id: data.id, label },
  });

  revalidatePath("/app/assets");
  revalidatePath("/app/activity");
}

export async function setAssetStatus(assetId: string, status: string) {
  const ctx = await requireAuth();
  const supabase = await createClient();
  if (!ASSET_STATUSES.includes(status as AssetStatus)) throw new Error("Invalid status.");

  const { data: asset } = await supabase
    .from("assets")
    .select("id, tenant_id, label")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) throw new Error("Not found.");

  const { error } = await supabase
    .from("assets")
    .update({ status, updated_by: ctx.userId })
    .eq("id", assetId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    tenantId: asset.tenant_id,
    actorId: ctx.userId,
    verb: status === "used" ? "asset.used" : "asset.status_changed",
    objectType: "asset",
    objectId: assetId,
    summary: `moved footage “${asset.label}” to ${ASSET_STATUS_LABELS[status as AssetStatus]}`,
    payload: { id: assetId, status },
  });

  revalidatePath("/app/assets");
  revalidatePath("/app/activity");
}

export async function updateAsset(assetId: string, formData: FormData) {
  const ctx = await requireAuth();
  const supabase = await createClient();

  const { data: asset } = await supabase
    .from("assets")
    .select("id, tenant_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset) throw new Error("Not found.");

  const linked = str(formData, "linked_calendar_entry_id");
  const { error } = await supabase
    .from("assets")
    .update({
      note: str(formData, "note"),
      linked_calendar_entry_id: linked || null,
      updated_by: ctx.userId,
    })
    .eq("id", assetId);
  if (error) throw new Error(error.message);

  revalidatePath("/app/assets");
}
