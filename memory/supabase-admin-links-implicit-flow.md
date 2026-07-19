# Supabase admin-generated links use the IMPLICIT flow (hash tokens), not PKCE

Discovered during live bring-up. Two magic-link paths behave differently:

- **Email `signInWithOtp`** (the normal client login) → **PKCE**: link carries `?code=...`,
  exchanged server-side by `/auth/callback/route.ts` (`exchangeCodeForSession`). Fine.
- **`auth.admin.generateLink({ type: 'magiclink' })`** (the admin Invite flow, and any link
  minted with the service role) → **IMPLICIT**: after Supabase's `/auth/v1/verify`, the user
  lands with tokens in the **URL fragment** (`#access_token=...&refresh_token=...`).

Key consequence: a **server route handler can never read a URL fragment** — browsers don't
send the part after `#` to the server. So admin links must be caught **client-side**.

Fix in this repo:
- `src/app/login/page.tsx` has a `useEffect` that detects `window.location.hash` containing
  `access_token`, calls `supabase.auth.setSession({ access_token, refresh_token })`, then
  redirects to `/`. Shows a "Signing you in…" state.
- `src/app/admin/actions.ts` `inviteClient` sets `redirectTo: ${SITE_URL}/login` (NOT
  `/auth/callback`), so implicit-flow links land where the fragment handler lives.

Also: Supabase silently **drops the `redirect_to` path** to the bare origin unless the exact
URL is in **Auth → URL Configuration → Redirect URLs**. It still works because the fragment
survives the same-origin redirect (origin → `/` → middleware → `/login#...`), but add
`http://localhost:3000/**` and the deployed `https://.../**` to make `redirect_to` honored
and to enable real SMTP email links. Related: [[magic-link-invite-flow]].
