# Supabase magic links have THREE resolution flows — pick per delivery channel

Cost us a real client-blocking bug: the client clicked their emailed link over and over and
was always bounced back to `/login`.

| Flow | Handler | Carries | Works when |
|---|---|---|---|
| **PKCE** | `/auth/callback` (server) | `?code=` | Only in the **same browser** that requested the link — needs the `code_verifier` cookie `signInWithOtp` set. |
| **Implicit** | `/login` (client-side `useEffect`) | `#access_token=` **fragment** | Links from `auth.admin.generateLink` (admin Invite). A server route can **never** read a fragment — browsers don't send it. |
| **Token hash** | `/auth/confirm` (server) | `?token_hash=` + `verifyOtp` | **Any** browser/device. No cookie needed. |

**The trap:** the in-app `/login` form uses PKCE, which is correct for someone signing in on
their laptop. But clients open email **on a phone, in Gmail's in-app browser** — a different
browser context with no `code_verifier`. The exchange fails and they loop forever, with no
useful error.

**Rule: emailed links must use the token-hash flow.** Set the Supabase Magic Link template to
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink&next=/`.

Second trap: Supabase **silently drops the path** from `redirect_to` when it doesn't match
*Auth → URL Configuration → Redirect URLs*, dumping the user on `/` with an unhandled `?code=`.
Add the `/**` wildcard (`https://app.example.com/**`), not just the bare origin. `middleware.ts`
now also rescues stray `?code=`/`?token_hash=` on any path by forwarding to the right handler —
defense in depth, but fix the allowlist too.

## Third trap: Gmail prefetch burns single-use email links (`otp_expired`)

Symptom: emailed magic link fails with `error_code=otp_expired` ("Email link is invalid or
has expired") even on a seemingly fresh click, while an admin `generateLink` clicked once works
fine. Cause: Gmail (and security scanners) **pre-fetch** links in emails to scan them. The
default Supabase email template's link IS the single-use `/auth/v1/verify?token=…` endpoint, so
the scanner's fetch **consumes the token** before the human taps it. Confirmed the mechanism is
fine by minting a link and following it with curl — it returns `access_token` (a fresh token
always works; a pre-fetched one is already spent).

Can't fix via template (OTP-code entry would dodge prefetch, but editing the template needs
custom SMTP, which this project lacks). Durable options: (a) working SMTP → template shows a
6-digit `{{ .Token }}` → OTP-code entry (prefetch-proof); (b) admin `generateLink` sent over
WhatsApp as the primary path (clicked once, promptly; sessions persist for weeks so re-auth is
rare). `/login` now surfaces the `otp_expired` error clearly instead of a blank form.

Related: [[supabase-admin-links-implicit-flow]] (the earlier half of this lesson).
