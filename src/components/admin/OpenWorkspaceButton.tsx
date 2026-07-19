"use client";

import { useRouter } from "next/navigation";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth.client";
import { Icon } from "@/components/icons";

export function OpenWorkspaceButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  return (
    <button
      className="btn-primary"
      onClick={() => {
        document.cookie = `${ACTIVE_TENANT_COOKIE}=${tenantId}; path=/; max-age=31536000; samesite=lax`;
        router.push("/app");
      }}
    >
      <Icon name="back" size={16} className="rotate-180" /> Open workspace
    </button>
  );
}
