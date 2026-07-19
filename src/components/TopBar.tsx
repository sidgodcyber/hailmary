import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { Icon } from "@/components/icons";
import { TenantSwitcher } from "@/components/TenantSwitcher";
import { SignOutButton } from "@/components/SignOutButton";

type TenantRef = { id: string; name: string };

export function TopBar({
  tenants,
  activeId,
  isAdmin,
}: {
  tenants: TenantRef[];
  activeId: string | null;
  isAdmin: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
        <Link href="/app" className="flex items-center gap-2 shrink-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">
            {APP_NAME.charAt(0)}
          </span>
          <span className="hidden xs:inline font-bold tracking-tight">{APP_NAME}</span>
        </Link>

        <div className="flex-1 min-w-0 flex items-center justify-center">
          <TenantSwitcher tenants={tenants} activeId={activeId} />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Icon name="shield" size={18} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
