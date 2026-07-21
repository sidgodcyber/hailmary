import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase auth cookie on every request and gates protected
 * routes. Runs in middleware.ts. Keep this lean — no DB queries here beyond
 * getUser(), which validates the session with Supabase.
 */
export async function updateSession(request: NextRequest) {
  // Rescue auth links that landed on the wrong path. Supabase drops the path
  // from redirect_to when it doesn't match the Redirect URL allowlist, so a
  // sign-in link can arrive at "/" carrying ?code= or ?token_hash= that nobody
  // handles — the user just bounces to /login forever. Route them to the
  // handler that can actually complete the sign-in.
  const url = request.nextUrl;
  const path = url.pathname;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");

  if (tokenHash && path !== "/auth/confirm") {
    const dest = url.clone();
    dest.pathname = "/auth/confirm";
    dest.searchParams.set("type", url.searchParams.get("type") || "magiclink");
    dest.searchParams.set("next", path === "/" ? "/" : path);
    return NextResponse.redirect(dest);
  }

  if (code && path !== "/auth/callback" && path !== "/auth/confirm") {
    const dest = url.clone();
    dest.pathname = "/auth/callback";
    dest.searchParams.set("next", path === "/" ? "/" : path);
    return NextResponse.redirect(dest);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = path.startsWith("/app") || path.startsWith("/admin");

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
