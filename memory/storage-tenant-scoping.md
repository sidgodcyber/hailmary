# Tenant-scoping private media in Supabase Storage

Added in v1.5 item 4 (`0005_attachments.sql` + `0006_storage.sql`). Item 5's voicenotes reuse
this exact plumbing, so read this before adding any new bucket-backed table.

## The model
- ONE private bucket `media` (20 MB per object). Never public — served only via short-lived
  `createSignedUrl`.
- Object path: `{tenant_id}/{parent_type}/{parent_id}/{uuid}-{name}`. The **first path segment is
  the tenant id, and it is the entire basis for access**.
- `storage.objects` RLS = `bucket_id='media' AND (is_admin() OR is_member_of(storage_tenant_id(name)))`.
- `public.storage_tenant_id(text)` returns the first segment as uuid, or **NULL** when it isn't a
  uuid. Two reasons it isn't a bare `::uuid` cast: a cast raises inside a policy and aborts the
  whole request, and `is_member_of(null)` is false — so a malformed path fails closed.
  It lives in `0005`, NOT `0006`, so PGlite can test it (see below).

## The non-obvious hole (this is the important part)
Table RLS alone is NOT enough. A member of tenant A can legitimately insert an `attachments` row
**in their own tenant** — RLS is satisfied — while setting `storage_path` to a path inside tenant
B's folder. The app then signs that path on their behalf. RLS never fires, because nothing about
the row is cross-tenant except a string.

Fix = a CHECK constraint tying the path to the row's own tenant:
`left(storage_path, 37) = tenant_id::text || '/'` (uuid text is always 36 chars).
This also defeats prefix confusion like `{A}{B}/…`, which a naive `like tenant_id || '%'` would let
through. **Any new table holding a storage path needs its own copy of this constraint.**

Three layers total, all verified: the CHECK, the server action re-deriving tenant from the session
(never the form) and re-validating the path, and signing through the **RLS-bound** client so
storage RLS refuses foreign paths.

## Testing it without a storage schema
PGlite has no `storage` schema, so `0006` is deliberately excluded from `tests/setup/db.ts`.
Keeping `storage_tenant_id()` in `0005` means the suite can still evaluate the exact policy
predicate — `select is_admin() or is_member_of(storage_tenant_id($1))` — against real paths for
client / admin / stranger. The bucket policies themselves still need a live signed-URL round-trip.

Worth repeating: when a test asserts a rejection, assert on the *constraint name*, not a generic
"violates" — otherwise an RLS rejection silently passes a test meant to prove the CHECK works.

## Uploads bypass the server on purpose
Vercel caps a serverless request body at 4.5 MB, so a 20 MB video cannot go through a server
action. The browser uploads straight to Storage with the anon key + user session, which is why
storage RLS is load-bearing rather than decorative. A server action records the row afterwards and
re-validates the path; the uploader deletes the object if that insert fails, so a failed upload
doesn't leak storage budget.

Related: [[multi-tenant-rls-model]], [[rls-testing-with-pglite]], [[vercel-hobby-constraints]].
