import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing. Supabase redirects here with a one-time `code` (PKCE).
 * We exchange it for a session cookie, then bounce to `next`. The code is
 * single-use and expiring — Supabase Auth enforces both.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${dest}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
