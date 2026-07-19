import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { Icon } from "@/components/icons";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-[color:var(--line)] bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-white text-sm font-bold">
              {APP_NAME.charAt(0)}
            </span>
            <span className="font-bold tracking-tight">
              {APP_NAME} <span className="text-ink-muted font-medium">admin</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              <Icon name="back" size={16} /> <span className="hidden sm:inline">Client view</span>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 pb-16">{children}</main>
    </div>
  );
}
