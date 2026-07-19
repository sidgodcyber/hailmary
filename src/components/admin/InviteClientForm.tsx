"use client";

import { useActionState, useState } from "react";
import { inviteClient } from "@/app/admin/actions";
import { Icon } from "@/components/icons";

export function InviteClientForm({ tenantId }: { tenantId: string }) {
  const action = inviteClient.bind(null, tenantId);
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState(false);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; the link is selectable in the field */
    }
  }

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="invite_email" className="label">
            Client email
          </label>
          <input
            id="invite_email"
            name="email"
            type="email"
            required
            placeholder="client@example.com"
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "…" : "Invite"}
        </button>
      </form>

      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      {state?.link && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3">
          <p className="text-sm font-semibold text-brand-800">Magic sign-in link ready</p>
          <p className="text-xs text-ink-muted mb-2">
            Single-use and expiring. Send it to the client by email or WhatsApp.
          </p>
          <div className="flex items-center gap-2">
            <input readOnly value={state.link} className="input text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={() => copy(state.link!)} className="btn-ghost shrink-0">
              <Icon name="link" size={16} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
