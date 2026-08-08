import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MEDIA_BUCKET, SIGNED_URL_TTL_SECONDS } from "@/lib/config";
import { logError } from "@/lib/log";

export {
  formatBytes,
  kindForMime,
  mediaObjectPath,
  pathIsInTenant,
  safeExternalUrl,
  sanitizeFileName,
} from "@/lib/media.client";

/**
 * Mint short-lived signed URLs for private media.
 *
 * ALWAYS pass the caller's RLS-bound client (never the service role): signing
 * goes through storage.objects RLS, so a path outside the caller's tenant
 * simply fails to sign. That's the last of the three layers guarding
 * cross-tenant media — the other two are the attachments CHECK constraint and
 * the server-side path validation in the attach action.
 *
 * Failures are logged and omitted rather than thrown: one broken object must
 * not blank out the whole post.
 */
export async function signMediaUrls(
  supabase: SupabaseClient,
  paths: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);

  if (error) {
    logError("media.sign_failed", { count: unique.length, error: error.message });
    return out;
  }

  for (const row of data ?? []) {
    if (row.signedUrl && row.path) out.set(row.path, row.signedUrl);
    else if (row.error) logError("media.sign_skipped", { error: String(row.error) });
  }
  return out;
}

/** Best-effort removal of stored objects. Row deletion is the source of truth. */
export async function removeMediaObjects(
  supabase: SupabaseClient,
  paths: string[]
): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(unique);
  if (error) logError("media.remove_failed", { count: unique.length, error: error.message });
}
