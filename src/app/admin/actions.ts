"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/config";
import { logError } from "@/lib/log";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "tenant"
  );
}

export async function createTenant(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const name = (formData.get("name") ?? "").toString().trim();
  if (!name) throw new Error("A client name is required.");

  let slug = slugify(name);
  const { data: existing } = await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase.from("tenants").insert({ name, slug }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create client.");

  revalidatePath("/admin");
  revalidatePath("/admin/tenants");
  redirect(`/admin/tenants/${data.id}`);
}

/**
 * Ensure the client user exists (role=client), is linked to the tenant, and
 * return a fresh single-use magic sign-in link. The link is NOT emailed here —
 * it is returned so you can send it however you like (email or, since clients
 * live on WhatsApp, paste it into a WhatsApp message).
 */
export async function inviteClient(
  tenantId: string,
  _prev: { link?: string; error?: string } | null,
  formData: FormData
): Promise<{ link?: string; error?: string }> {
  try {
    await requireAdmin();
    const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
    if (!email) return { error: "Enter an email address." };

    const admin = createAdminClient();

    // find or create the auth user
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    let user = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { role: "client" },
      });
      if (error) throw error;
      user = data.user;
    } else {
      await admin.auth.admin.updateUserById(user.id, { app_metadata: { role: "client" } });
    }

    await admin.from("profiles").upsert({ id: user.id, email, global_role: "client" });
    await admin
      .from("memberships")
      .upsert({ tenant_id: tenantId, user_id: user.id, role: "client" }, { onConflict: "tenant_id,user_id" });

    // Admin-generated links resolve via Supabase's IMPLICIT flow (tokens in the
    // URL fragment), not the PKCE ?code= flow /auth/callback expects — a server
    // route handler can never see a fragment. Point these at /login instead,
    // which detects and processes fragment tokens client-side (see login/page.tsx).
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${SITE_URL}/login` },
    });
    if (linkErr) throw linkErr;

    revalidatePath(`/admin/tenants/${tenantId}`);
    return { link: linkData.properties?.action_link };
  } catch (err) {
    logError("invite.failed", { error: (err as Error).message });
    return { error: (err as Error).message || "Could not create the invite." };
  }
}
