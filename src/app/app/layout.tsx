import { requireAuth } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();
  const tenants = ctx.tenants.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="min-h-dvh">
      <TopBar tenants={tenants} activeId={ctx.activeTenant?.id ?? null} isAdmin={ctx.isAdmin} />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        {ctx.activeTenant ? (
          children
        ) : (
          <div className="card p-6 text-center text-ink-muted">
            No workspace is linked to your account yet. Please check back once
            you&apos;ve been invited.
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
