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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    const supabase = createClient();
    // Land back on /login, not /auth/callback: with the implicit flow the
    // session arrives in the URL fragment, and only client-side code can read
    // a fragment (browsers never send it to the server).
    const redirectTo = `${window.location.origin}/login?next=${encodeURIComponent(next)}`;
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
          )}
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
