import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth.client";

export { ACTIVE_TENANT_COOKIE };

export type TenantRef = { id: string; name: string; slug: string };

export type AuthContext = {
  userId: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  /** Tenants this user may act in — a client has exactly one; an admin has all. */
  tenants: TenantRef[];
  /** The tenant currently in view (admin can switch; client is fixed). */
  activeTenant: TenantRef | null;
};

/**
 * Resolve the logged-in user's role and tenant context. Returns null when
 * there is no valid session. All queries here run under the user's own RLS.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // profile (role) and the tenant list are independent — fetch in parallel.
  // The `tenants` select is RLS-scoped: a client sees only their own tenant(s)
  // via is_member_of(); an admin sees all via is_admin(). So one query serves
  // both roles and needs no branch on isAdmin, cutting a round-trip.
  const [profileRes, tenantsRes, cookieStore] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name, global_role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("tenants").select("id, name, slug").order("name"),
    cookies(),
  ]);

  const profile = profileRes.data;
  const isAdmin = profile?.global_role === "admin";
  const tenants = (tenantsRes.data ?? []) as TenantRef[];

  const wanted = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
  const activeTenant = tenants.find((t) => t.id === wanted) ?? tenants[0] ?? null;

  return {
    userId: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? null,
    isAdmin,
    tenants,
    activeTenant,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.isAdmin) redirect("/app");
  return ctx;
}

/** True when the user may act within tenantId (member, or admin). */
export function canAccessTenant(ctx: AuthContext, tenantId: string): boolean {
  return ctx.isAdmin || ctx.tenants.some((t) => t.id === tenantId);
}

/**
 * The tenant a request should operate on. Optional `wanted` (e.g. from a form)
 * is honored only if the user can access it; otherwise falls back to the
 * active tenant. Throws if there is no accessible tenant.
 */
export function resolveTenant(ctx: AuthContext, wanted?: string | null): TenantRef {
  if (wanted) {
    const t = ctx.tenants.find((x) => x.id === wanted);
    if (t) return t;
  }
  if (ctx.activeTenant) return ctx.activeTenant;
  throw new Error("No accessible tenant for this user");
}
