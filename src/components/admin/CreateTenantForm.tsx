"use client";

import { useFormStatus } from "react-dom";
import { createTenant } from "@/app/admin/actions";
import { Icon } from "@/components/icons";

function AddBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Creating…" : "Create client"}
    </button>
  );
}

export function CreateTenantForm() {
  return (
    <details className="card p-4 group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon name="plus" size={18} />
        </span>
        Add a client (new tenant)
      </summary>
      <form action={createTenant} className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="tenant_name" className="label">
            Client name
          </label>
          <input id="tenant_name" name="name" required placeholder="e.g. Roven Straps" className="input" />
        </div>
        <AddBtn />
      </form>
      <p className="mt-2 text-xs text-ink-muted">
        Adding a client is a data operation — no code change. You can invite their login next.
      </p>
    </details>
  );
}
