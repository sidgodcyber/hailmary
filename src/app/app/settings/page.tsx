import { requireAuth } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { displayName } from "@/lib/format";

export default async function SettingsPage() {
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant;

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Your account</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Name</dt>
            <dd className="font-medium text-right">{displayName(ctx.fullName, ctx.email)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Email</dt>
            <dd className="font-medium text-right break-all">{ctx.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Role</dt>
            <dd className="font-medium text-right">{ctx.isAdmin ? "Studio (admin)" : "Client"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Workspace</dt>
            <dd className="font-medium text-right">{tenant?.name ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-2">About your data</h2>
        <div className="space-y-2 text-sm text-ink-muted">
          <p>
            {APP_NAME} is the shared workspace your studio runs for our collaboration —
            ideas, briefs, tasks and the content calendar all live here.
          </p>
          <p>
            The workspace and its contents are managed by the studio. If you need a
            copy of specific material, just ask your studio contact and they can put
            it together for you.
          </p>
          <p>
            We sign you in with one-time magic links (no passwords), and each workspace
            is isolated so clients only ever see their own.
          </p>
        </div>
      </section>

      <section className="card p-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Sign out</h2>
          <p className="text-sm text-ink-muted">End your session on this device.</p>
        </div>
        <SignOutButton />
      </section>
    </div>
  );
}
