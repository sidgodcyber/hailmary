"use client";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (browser). ANON key only — never the
 * service role. Used for the magic-link sign-in request and sign-out.
 *
 * flowType: "implicit" is deliberate. @supabase/ssr defaults to PKCE, which
 * requires the `code_verifier` cookie set in the browser that REQUESTED the
 * link. Clients open sign-in emails on a phone, in Gmail's in-app browser —
 * a different browser context with no such cookie — so PKCE fails there and
 * they loop back to /login forever.
 *
 * Implicit returns the session in the URL **fragment**, which /login handles
 * client-side, so a link works from any device. The usual fix (point the email
 * template at /auth/confirm + verifyOtp) is unavailable here: Supabase locks
 * email-template editing behind custom SMTP, which this project doesn't have.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
}
