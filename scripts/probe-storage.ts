/**
 * Live verification of the `media` bucket's tenant isolation.
 *
 * PGlite can't host the storage schema, so the bucket policies are the one part
 * of item 4 that unit tests cannot reach. This script proves them against the
 * real project by acting as a genuine logged-in user (real JWT, anon key —
 * exactly what the browser uploader holds) and trying to cross tenants.
 *
 * It creates a throwaway tenant + user, probes against the REAL tenant's
 * folder, and deletes everything it made. Run: npx tsx scripts/probe-storage.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !ANON || !SERVICE) throw new Error("Missing Supabase env vars");

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// 1x1 jpeg — small, and a MIME the bucket actually allows.
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
);

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const stamp = Date.now();
  const email = `storage-probe-${stamp}@hailmary-probe.invalid`;
  const password = `Pw-${crypto.randomUUID()}`;
  let userId: string | null = null;
  let tenantId: string | null = null;
  const uploaded: string[] = [];

  // The real tenant we must NOT be able to touch.
  const { data: realTenants } = await admin.from("tenants").select("id, name").order("name");
  const real = realTenants?.[0];
  if (!real) throw new Error("No existing tenant to probe against");
  console.log(`\nProbing against real tenant: ${real.name} (${real.id})\n`);

  try {
    // ---- setup: throwaway tenant + member ----
    const { data: t, error: tErr } = await admin
      .from("tenants")
      .insert({ name: `ZZ storage probe ${stamp}`, slug: `zz-storage-probe-${stamp}` })
      .select("id")
      .single();
    if (tErr) throw tErr;
    tenantId = t.id;

    const { data: u, error: uErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "client" },
    });
    if (uErr) throw uErr;
    userId = u.user.id;

    await admin.from("profiles").upsert({ id: userId, email, global_role: "client" });
    await admin.from("memberships").insert({ tenant_id: tenantId, user_id: userId, role: "client" });

    // ---- act as that user, with the anon key, like the browser does ----
    const asUser = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: session, error: sErr } = await asUser.auth.signInWithPassword({ email, password });
    if (sErr || !session.session) throw sErr ?? new Error("no session");
    console.log("Signed in as throwaway client.\n");

    const mine = `${tenantId}/calendar/${crypto.randomUUID()}/probe.jpg`;
    const theirs = `${real.id}/calendar/${crypto.randomUUID()}/stolen.jpg`;

    // 1. upload into own tenant folder -> allowed
    const own = await asUser.storage.from("media").upload(mine, JPEG, { contentType: "image/jpeg" });
    check("upload into OWN tenant folder is allowed", !own.error, own.error?.message ?? "");
    if (!own.error) uploaded.push(mine);

    // 2. upload into the real tenant's folder -> denied  (the money test)
    const cross = await asUser.storage
      .from("media")
      .upload(theirs, JPEG, { contentType: "image/jpeg" });
    check("upload into ANOTHER tenant's folder is DENIED", !!cross.error, cross.error?.message ?? "NO ERROR — LEAK");
    if (!cross.error) uploaded.push(theirs);

    // 3. sign own path -> works, and the URL actually serves the bytes
    const signMine = await asUser.storage.from("media").createSignedUrl(mine, 60);
    check("own path signs", !!signMine.data?.signedUrl, signMine.error?.message ?? "");
    if (signMine.data?.signedUrl) {
      const res = await fetch(signMine.data.signedUrl);
      const bytes = Buffer.from(await res.arrayBuffer());
      check(
        "signed URL serves the real bytes",
        res.status === 200 && bytes.length === JPEG.length,
        `HTTP ${res.status}, ${bytes.length}B`
      );
    }

    // 4. seed one object in the real tenant (service role) and try to sign it as our user
    const plant = `${real.id}/calendar/${crypto.randomUUID()}/planted.jpg`;
    const planted = await admin.storage.from("media").upload(plant, JPEG, { contentType: "image/jpeg" });
    if (!planted.error) {
      uploaded.push(plant);
      const signTheirs = await asUser.storage.from("media").createSignedUrl(plant, 60);
      check(
        "another tenant's EXISTING object refuses to sign",
        !signTheirs.data?.signedUrl,
        signTheirs.data?.signedUrl ? "SIGNED — LEAK" : signTheirs.error?.message ?? ""
      );
    } else {
      console.log(`  (skip) could not plant object as service role: ${planted.error.message}`);
    }

    // 5. listing another tenant's folder shows nothing
    const list = await asUser.storage.from("media").list(real.id);
    check(
      "listing another tenant's folder returns nothing",
      (list.data?.length ?? 0) === 0,
      `${list.data?.length ?? 0} entries`
    );

    // 6. the attachments CHECK, live: claim a path in the real tenant's folder
    const badRow = await asUser
      .from("attachments")
      .insert({
        tenant_id: tenantId,
        parent_type: "calendar",
        parent_id: crypto.randomUUID(),
        kind: "image",
        storage_path: theirs,
        size_bytes: 10,
      })
      .select("id");
    check(
      "attachments row claiming a foreign path is REJECTED",
      !!badRow.error,
      badRow.error?.message ?? "NO ERROR — LEAK"
    );

    await asUser.auth.signOut();
  } finally {
    // ---- cleanup, whatever happened ----
    console.log("\nCleaning up…");
    if (uploaded.length) {
      const { error } = await admin.storage.from("media").remove(uploaded);
      console.log(`  objects removed: ${uploaded.length}${error ? ` (error: ${error.message})` : ""}`);
    }
    if (tenantId) {
      await admin.from("attachments").delete().eq("tenant_id", tenantId);
      await admin.from("memberships").delete().eq("tenant_id", tenantId);
      await admin.from("tenants").delete().eq("id", tenantId);
      console.log("  throwaway tenant removed");
    }
    if (userId) {
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      console.log("  throwaway user removed");
    }
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("\nProbe crashed:", e);
  process.exit(1);
});
