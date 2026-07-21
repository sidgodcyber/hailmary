import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logError } from "@/lib/log";

/**
 * Append one row to the per-tenant activity feed. Called from every mutation so
 * attribution + timestamps are consistent, and so the Gravity read API has a
 * complete `payload` to hand out. Uses the caller's RLS-bound client.
 */
export type ActivityInput = {
  tenantId: string;
  actorId: string | null;
  verb: string;
  objectType:
    | "idea"
    | "reference"
    | "task"
    | "calendar"
    | "comment"
    | "brief"
    | "tenant"
    | "asset"
    | "attachment"
    | "voicenote";
  objectId?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
};

export async function logActivity(
  supabase: SupabaseClient,
  input: ActivityInput
): Promise<void> {
  const { error } = await supabase.from("activity").insert({
    tenant_id: input.tenantId,
    actor_id: input.actorId,
    verb: input.verb,
    object_type: input.objectType,
    object_id: input.objectId ?? null,
    summary: input.summary,
    payload: input.payload ?? {},
  });
  if (error) {
    // ids + verb only, never the payload contents
    logError("activity.insert_failed", {
      verb: input.verb,
      objectType: input.objectType,
      objectId: input.objectId,
      error: error.message,
    });
  }
}
