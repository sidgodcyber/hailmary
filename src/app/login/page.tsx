"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/config";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "confirming">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  // Admin-generated links (the Invite flow, or any auth.admin.generateLink
  // output) resolve via Supabase's IMPLICIT flow: tokens arrive in the URL
  // fragment (#access_token=...&refresh_token=...), never as a ?code= query
  // param. A server route can never see a fragment (browsers don't send it),
  // so this client-side landing spot is the only place that CAN catch it.
  // The regular email signInWithOtp flow still uses PKCE via /auth/callback
  // and is unaffected by this.
  useEffect(() => {
    const hash = window.location.hash;
    const query = window.location.search;

    // Surface an error carried back by the link (in the fragment OR the query)
    // instead of silently showing a blank form. otp_expired is the common one:
    // email scanners (Gmail) pre-fetch the single-use link and burn the token
    // before the human taps it.
    const errText = `${hash} ${query}`;
    if (errText.includes("error=") || errText.includes("otp_expired")) {
      setStatus("error");
      setMessage(
        errText.includes("otp_expired") || errText.includes("expired")
          ? "That sign-in link had already expired or been used. Request a fresh one below and open it right away."
          : "That sign-in link didn't work. Request a new one below."
      );
      // clean the ugly error params out of the address bar
      window.history.replaceState(null, "", "/login");
      return;
    }

    if (!hash || !hash.includes("access_token")) return;

    setStatus("confirming");
    const p = new URLSearchParams(hash.slice(1));
    const access_token = p.get("access_token");
    const refresh_token = p.get("refresh_token");
    if (!access_token || !refresh_token) {
      setStatus("error");
      setMessage("That sign-in link looks incomplete. Please request a new one.");
      return;
    }

    const supabase = createClient();
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setMessage(error.message);
      } else {
        window.location.replace(next.startsWith("/") ? next : "/");
      }
    });
    // `next` is read from the query string on this same URL; it is stable for
    // the life of this landing, so a one-shot effect is correct here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithGoogle() {
    setGoogleLoading(true);
    setMessage("");
    const supabase = createClient();
    // Implicit flow: Google → Supabase → back to /login with the session in the
    // URL fragment, which the effect above reads. Same one-tap browser, so no
    // cross-device/cookie problem and no email in the loop at all.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Server-side PKCE exchange at /auth/callback → deterministic cookie +
        // redirect. Same browser throughout, so the code_verifier is present.
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      setStatus("error");
      setMessage(error.message);
    }
    // on success the browser is already navigating to Google — nothing else to do
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const supabase = createClient();
    // Same-browser PKCE exchange at /auth/callback. (Cross-device email links
    // remain unreliable due to Gmail's link prefetch — Google sign-in is the
    // primary path now; this email form is a secondary convenience.)
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setStatus("error");
      setMessage(error.message);
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white text-xl font-bold shadow-soft">
            {APP_NAME.charAt(0)}
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Your workspace for ideas, briefs and the content calendar.
          </p>
        </div>

        <div className="card p-6">
          {status === "confirming" ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">🔐</div>
              <h2 className="font-semibold">Signing you in…</h2>
              <p className="mt-1.5 text-sm text-ink-muted">One moment.</p>
            </div>
          ) : status === "sent" ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">✉️</div>
              <h2 className="font-semibold">Check your email</h2>
              <p className="mt-1.5 text-sm text-ink-muted">
                We sent a magic sign-in link to <span className="font-medium text-ink">{email}</span>.
                Open it on this device to continue.
              </p>
              <button
                className="btn-ghost mt-5 w-full"
                onClick={() => setStatus("idle")}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={googleLoading}
                className="btn-ghost w-full !py-3 font-semibold"
              >
                <GoogleG />
                {googleLoading ? "Redirecting…" : "Continue with Google"}
              </button>

              <div className="flex items-center gap-3 text-xs text-ink-muted">
                <span className="h-px flex-1 bg-[color:var(--line)]" />
                or
                <span className="h-px flex-1 bg-[color:var(--line)]" />
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending…" : "Send magic link"}
              </button>
              {status === "error" && (
                <p className="text-sm text-red-600" role="alert">
                  {message || "Something went wrong. Please try again."}
                </p>
              )}
              <p className="text-xs text-ink-muted text-center pt-1">
                No passwords. We email you a one-time link that signs you in.
              </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
