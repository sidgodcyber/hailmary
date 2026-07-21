import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email link landing spot — the ROBUST one.
 *
 * Unlike /auth/callback (PKCE `?code=`), this verifies a `token_hash` and needs
 * NO code_verifier cookie. That matters because emailed links are usually
 * opened somewhere other than the browser that requested them (Gmail's in-app
 * browser, a phone, a different device). PKCE fails there by design; verifyOtp
 * does not.
 *
 * Supabase email template should point here:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const dest = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
