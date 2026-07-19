"use client";

import { useRouter } from "next/navigation";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth.client";

type TenantRef = { id: string; name: string };

export function TenantSwitcher({
  tenants,
  activeId,
}: {
  tenants: TenantRef[];
  activeId: string | null;
}) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    // Non-sensitive: RLS still governs access. For clients this cookie is
    // ignored server-side unless it names a tenant they belong to.
    document.cookie = `${ACTIVE_TENANT_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  if (tenants.length <= 1) {
    return (
      <span className="text-sm font-semibold text-ink truncate max-w-[10rem]">
        {tenants[0]?.name ?? "—"}
      </span>
    );
  }

  return (
    <select
      aria-label="Active client"
      value={activeId ?? ""}
      onChange={onChange}
      className="rounded-lg border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-sm font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-brand-400 max-w-[12rem]"
    >
      {tenants.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}
