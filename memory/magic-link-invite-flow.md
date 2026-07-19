# Magic-link auth + the invite flow (WhatsApp-friendly)

Auth is passwordless magic links only (Supabase `signInWithOtp`, PKCE). Sign-in:
`/login` → email → Supabase emails a link → `/auth/callback` exchanges the `code` for a
session cookie (`exchangeCodeForSession`). Links are single-use and expiring (Supabase).

Invite flow (`inviteClient` in `src/app/admin/actions.ts`), important because clients live on
WhatsApp and SMTP may not be configured:
1. Ensure the auth user exists with `app_metadata.role = 'client'` (create via
   `auth.admin.createUser` or update).
2. Upsert `profiles` + `memberships` (link to the tenant).
3. `auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })` returns
   `data.properties.action_link` — a ready single-use link.
4. The admin UI shows that link with a copy button; the studio can paste it into WhatsApp or
   email. No SMTP dependency.

To automate WhatsApp delivery later: POST the `action_link` to a WhatsApp Business API /
provider instead of showing it. No architecture change. Documented in README.

Gotcha: `generateLink` type `magiclink` is for existing users — create the user first (we do).
