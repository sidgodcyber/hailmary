"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

const TABS = [
  { href: "/app/ideas", label: "Ideas", icon: "idea" as const },
  { href: "/app/tasks", label: "Tasks", icon: "task" as const },
  { href: "/app/calendar", label: "Calendar", icon: "calendar" as const },
  { href: "/app/assets", label: "Assets", icon: "film" as const },
  { href: "/app/activity", label: "Activity", icon: "activity" as const },
  { href: "/app/settings", label: "Settings", icon: "settings" as const },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-[color:var(--line)] bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-brand-700" : "text-ink-muted hover:text-ink"
                }`}
              >
                <Icon name={t.icon} size={22} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
