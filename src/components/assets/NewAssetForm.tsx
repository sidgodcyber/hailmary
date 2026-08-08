"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createAsset } from "@/app/app/assets/actions";
import { Icon } from "@/components/icons";

function AddBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Adding…" : "Add footage"}
    </button>
  );
}

export function NewAssetForm({ tenantId }: { tenantId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <details className="card p-4 group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon name="plus" size={18} />
        </span>
        Add footage
      </summary>
      <form
        ref={ref}
        action={async (fd) => {
          await createAsset(fd);
          ref.current?.reset();
          (ref.current?.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
        }}
        className="mt-4 space-y-3"
      >
        <input type="hidden" name="tenant" value={tenantId} />
        <div>
          <label htmlFor="a_label" className="label">
            Label
          </label>
          <input id="a_label" name="label" required placeholder="e.g. 5 clips — sourcing trip" className="input" />
        </div>
        <div>
          <label htmlFor="a_drive" className="label">
            Google Drive link <span className="font-normal normal-case text-ink-muted">(file or folder)</span>
          </label>
          <input id="a_drive" name="drive_url" type="url" inputMode="url" placeholder="https://drive.google.com/…" className="input" />
          <p className="mt-1 text-xs text-ink-muted">
            A folder can be one row, or split into several — just paste the same link again with a different label.
          </p>
        </div>
        <AddBtn />
      </form>
    </details>
  );
}
