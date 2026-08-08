"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (browser). ANON key only — never the
 * service role. Used for Google OAuth, the magic-link request, and sign-out.
 *
 * PKCE flow (the default). Google sign-in and same-browser email links both go
 * through the server route /auth/callback, which exchanges the ?code= for a
 * session and writes the cookies deterministically — no client-side race.
 *
 * (An earlier `flowType: "implicit"` was reverted: its detectSessionInUrl
 * auto-handling raced the manual fragment handler on /login and swallowed the
 * post-OAuth redirect, leaving the user signed-in-but-stuck on /login. It also
 * never actually fixed emailed links — those die to Gmail's link prefetch, not
 * the flow type. Admin-invite links still arrive as implicit fragments from the
 * verify endpoint and are handled by /login; PKCE's detectSessionInUrl ignores
 * fragments, so there is no longer a race.)
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
