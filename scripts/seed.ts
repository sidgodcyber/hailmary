/**
 * Seed script — creates the Shunyethra tenant, the admin (you) and the client
 * login, plus demo content so you can click through immediately.
 *
 * Emails are env-driven (never hardcoded):
 *   ADMIN_EMAIL             — the studio/admin account (sees all tenants)
 *   SHUNYETHRA_CLIENT_EMAIL — the Shunyethra client login
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (server-only). Run: npm run seed
 * Safe to re-run: users/tenant/membership are upserted; demo content is only
 * added when the tenant has none yet.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { toDateKey } from "../src/lib/format";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const CLIENT_EMAIL = process.env.SHUNYETHRA_CLIENT_EMAIL;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    console.error(`\n✖ Missing ${name}. Copy .env.example to .env.local and fill it in.\n`);
    process.exit(1);
  }
  return value;
}

async function ensureUser(
  admin: SupabaseClient,
  email: string,
  role: "admin" | "client",
  fullName: string
): Promise<User> {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true, // no password; they sign in via magic link
      app_metadata: { role },
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    user = data.user;
    console.log(`  + created auth user ${email} (${role})`);
  } else {
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { role } });
    console.log(`  = auth user ${email} already exists (${role})`);
  }

  const { error: profErr } = await admin
    .from("profiles")
    .upsert({ id: user.id, email, full_name: fullName, global_role: role });
  if (profErr) throw profErr;

  return user;
}

async function ensureTenant(admin: SupabaseClient, name: string, slug: string): Promise<string> {
  const { data: existing } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (existing) {
    console.log(`  = tenant ${name} already exists`);
    return existing.id;
  }
  const { data, error } = await admin.from("tenants").insert({ name, slug }).select("id").single();
  if (error) throw error;
  console.log(`  + created tenant ${name}`);
  return data.id;
}

async function seedDemoContent(
  admin: SupabaseClient,
  tenantId: string,
  adminId: string,
  clientId: string
) {
  const { count } = await admin
    .from("ideas")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) > 0) {
    console.log("  = demo content already present, skipping");
    return;
  }

  const today = new Date();
  const day = (offset: number) => toDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));

  // 1) A plain idea from the client
  const { data: idea1, error: idea1Err } = await admin
    .from("ideas")
    .insert({
      tenant_id: tenantId,
      author_id: clientId,
      type: "idea",
      title: "Behind-the-scenes: how we source our materials",
      body: "Short, honest reel walking through where we get our materials and why it matters. Could build trust with new followers.",
      status: "discussing",
    })
    .select("id")
    .single();
  if (idea1Err) throw idea1Err;

  // 2) A reference brief from the admin, with a filled-in brief
  const { data: ref, error: refErr } = await admin
    .from("ideas")
    .insert({
      tenant_id: tenantId,
      author_id: adminId,
      type: "reference",
      title: "Fast-cut unboxing hook we love",
      status: "planned",
      ref_url: "https://www.instagram.com/reel/EXAMPLE123/",
      ref_likes: "The first second is a tight close-up with a snappy sound — no slow intro. Cuts land on the beat.",
      ref_like_tags: ["hook", "format", "audio"],
      maps_to_product: "The signature strap line",
      ref_notes: "We can recreate this with our packaging.",
      brief_concept: "Recreate the punchy unboxing energy for our signature strap.",
      brief_hook: "Extreme close-up of the box opening on the first beat of the audio.",
      brief_outline: "1) Beat-synced box open  2) Strap reveal  3) Quick wrist shot  4) Logo card + CTA",
      brief_caption: "Playful, short. End with 'Which colour first?' + link in bio.",
      brief_updated_by: adminId,
      brief_updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (refErr) throw refErr;

  // 3) Tasks — one for the studio, one for the client
  // Every object in a batch insert must have identical keys (PostgREST
  // rejects the whole batch with PGRST102 otherwise) — keep these in sync.
  const { error: tasksErr } = await admin.from("tasks").insert([
    {
      tenant_id: tenantId,
      title: "Draft caption options for the unboxing reel",
      details: "Give 3 caption directions to choose from.",
      assigned_to: "admin",
      due_date: day(3),
      status: "open",
      created_by: adminId,
    },
    {
      tenant_id: tenantId,
      title: "Send 5 raw clips of the material sourcing trip",
      details: "",
      assigned_to: "client",
      due_date: day(5),
      status: "open",
      created_by: adminId,
    },
  ]);
  if (tasksErr) throw tasksErr;

  // 4) Calendar entries this month, one carrying the reference brief
  const { data: cal1, error: cal1Err } = await admin
    .from("calendar_entries")
    .insert({
      tenant_id: tenantId,
      title: "Unboxing reel (from reference)",
      date: day(4),
      channel: "instagram",
      status: "drafted",
      linked_idea_id: ref?.id ?? null,
      brief_concept: "Recreate the punchy unboxing energy for our signature strap.",
      brief_hook: "Extreme close-up of the box opening on the first beat of the audio.",
      brief_outline: "1) Beat-synced box open  2) Strap reveal  3) Quick wrist shot  4) Logo card + CTA",
      brief_caption: "Playful, short. End with 'Which colour first?' + link in bio.",
      created_by: adminId,
      updated_by: adminId,
    })
    .select("id")
    .single();
  if (cal1Err) throw cal1Err;

  const { error: cal2Err } = await admin.from("calendar_entries").insert([
    {
      tenant_id: tenantId,
      title: "Material sourcing story",
      date: day(7),
      channel: "instagram",
      status: "idea",
      created_by: clientId,
      updated_by: clientId,
    },
    {
      tenant_id: tenantId,
      title: "WhatsApp broadcast: restock alert",
      date: day(9),
      channel: "whatsapp",
      status: "approved",
      created_by: adminId,
      updated_by: adminId,
    },
  ]);
  if (cal2Err) throw cal2Err;

  // 5) Comments on the idea and the reference
  const { error: commentsErr } = await admin.from("comments").insert([
    {
      tenant_id: tenantId,
      parent_type: "idea",
      parent_id: idea1?.id,
      author_id: adminId,
      body: "Love this. Let's keep it under 20s and shoot vertical.",
    },
    {
      tenant_id: tenantId,
      parent_type: "idea",
      parent_id: ref?.id,
      author_id: clientId,
      body: "Yes! I can film the box open tomorrow morning in natural light.",
    },
  ]);
  if (commentsErr) throw commentsErr;

  // 6) Activity feed rows (attributed)
  const { error: activityErr } = await admin.from("activity").insert([
    {
      tenant_id: tenantId,
      actor_id: clientId,
      verb: "idea.created",
      object_type: "idea",
      object_id: idea1?.id,
      summary: "posted a new idea “Behind-the-scenes: how we source our materials”",
      payload: { id: idea1?.id },
    },
    {
      tenant_id: tenantId,
      actor_id: adminId,
      verb: "reference.created",
      object_type: "reference",
      object_id: ref?.id,
      summary: "added a reference brief “Fast-cut unboxing hook we love”",
      payload: { id: ref?.id },
    },
    {
      tenant_id: tenantId,
      actor_id: adminId,
      verb: "brief.sent_to_calendar",
      object_type: "calendar",
      object_id: cal1?.id,
      summary: `sent “Unboxing reel (from reference)” to the calendar (${day(4)})`,
      payload: { id: cal1?.id, fromIdea: ref?.id },
    },
    {
      tenant_id: tenantId,
      actor_id: clientId,
      verb: "comment.created",
      object_type: "comment",
      object_id: ref?.id,
      summary: "commented on “Fast-cut unboxing hook we love”",
      payload: { parentId: ref?.id },
    },
  ]);
  if (activityErr) throw activityErr;

  console.log("  + seeded demo ideas, a reference brief, tasks, calendar entries, comments and activity");
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
  const adminEmail = requireEnv("ADMIN_EMAIL", ADMIN_EMAIL);
  const clientEmail = requireEnv("SHUNYETHRA_CLIENT_EMAIL", CLIENT_EMAIL);

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  console.log("Seeding Hailmary…");
  const adminUser = await ensureUser(admin, adminEmail, "admin", "Studio Admin");
  const clientUser = await ensureUser(admin, clientEmail, "client", "Shunyethra");
  const tenantId = await ensureTenant(admin, "Shunyethra", "shunyethra");

  const { error: memErr } = await admin
    .from("memberships")
    .upsert({ tenant_id: tenantId, user_id: clientUser.id, role: "client" }, { onConflict: "tenant_id,user_id" });
  if (memErr) throw memErr;
  console.log(`  = linked ${clientEmail} to Shunyethra`);

  await seedDemoContent(admin, tenantId, adminUser.id, clientUser.id);

  console.log("\n✓ Done. Sign in with a magic link at /login using either email:");
  console.log(`    admin  → ${adminEmail}`);
  console.log(`    client → ${clientEmail}\n`);
}

main().catch((err) => {
  console.error("\n✖ Seed failed:", err.message ?? err);
  process.exit(1);
});
