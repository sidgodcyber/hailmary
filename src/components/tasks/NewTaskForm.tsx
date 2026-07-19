"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createTask } from "@/app/app/tasks/actions";
import { Icon } from "@/components/icons";

function AddBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Adding…" : "Add task"}
    </button>
  );
}

export function NewTaskForm({ tenantId }: { tenantId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <details className="card p-4 group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon name="plus" size={18} />
        </span>
        New task
      </summary>
      <form
        ref={ref}
        action={async (fd) => {
          await createTask(fd);
          ref.current?.reset();
          (ref.current?.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
        }}
        className="mt-4 space-y-3"
      >
        <input type="hidden" name="tenant" value={tenantId} />
        <div>
          <label htmlFor="t_title" className="label">
            Task
          </label>
          <input id="t_title" name="title" required placeholder="e.g. Draft caption for launch reel" className="input" />
        </div>
        <div>
          <label htmlFor="t_details" className="label">
            Details <span className="font-normal normal-case text-ink-muted">(optional)</span>
          </label>
          <textarea id="t_details" name="details" rows={2} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="t_assigned" className="label">
              Assign to
            </label>
            <select id="t_assigned" name="assigned_to" defaultValue="admin" className="input">
              <option value="admin">Studio (me)</option>
              <option value="client">Client</option>
            </select>
          </div>
          <div>
            <label htmlFor="t_due" className="label">
              Due <span className="font-normal normal-case text-ink-muted">(optional)</span>
            </label>
            <input id="t_due" name="due_date" type="date" className="input" />
          </div>
        </div>
        <AddBtn />
      </form>
    </details>
  );
}
