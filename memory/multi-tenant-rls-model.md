# Multi-tenant isolation model (RLS)

Isolation is enforced in Postgres, not app code.

- Role lives in `auth.users.app_metadata.role` (`admin` | `client`), mirrored in
  `profiles.global_role`. Client→tenant links live in `memberships`.
- Two `SECURITY DEFINER` helpers in `public` (defined in `0002_rls.sql`):
  - `is_admin()` → current user's `profiles.global_role = 'admin'`.
  - `is_member_of(tid)` → a `memberships` row for `auth.uid()` + `tid`.
- Every domain table (`ideas`, `comments`, `tasks`, `calendar_entries`, `activity`) has RLS
  with `USING (is_admin() OR is_member_of(tenant_id))` and the same `WITH CHECK`.
- `profiles`/`memberships` have self-read policies + admin-write; `tenants` is readable by
  members/admin, writable by admin.

Consequences to remember:
- Admins pass RLS for **all** tenants, so app code must always filter by the active tenant id
  explicitly (the `activeTenant` from `getAuthContext`). It does everywhere.
- `service_role` (seed, admin export, Gravity API) bypasses RLS entirely — those paths do
  their own authorization first (admin session or bearer token) and scope by `tenant_id`.
- Adding a tenant (e.g. Roven) = create tenant + invite = pure data operation, no code change.

Verified adversarially in `tests/isolation.test.ts`. Related: [[rls-testing-with-pglite]].
