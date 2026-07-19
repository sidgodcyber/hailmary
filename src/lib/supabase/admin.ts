import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE client — full DB access, BYPASSES RLS. Server-only.
 *
 * Only three places may use this: the seed script, the admin-only data export,
 * and the Gravity read API. Each of those does its OWN authorization check
 * (admin session, or bearer token) BEFORE using this client, and scopes every
 * query by tenant explicitly. Never import this into a Client Component; the
 * key lives in SUPABASE_SERVICE_ROLE_KEY (not NEXT_PUBLIC_*), so it is never
 * shipped to the browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
