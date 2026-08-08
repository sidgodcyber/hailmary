"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveEntry, requestChanges, submitForApproval } from "@/app/app/calendar/actions";
import { Icon } from "@/components/icons";
import { relativeTime } from "@/lib/format";
import type { CalendarStatus } from "@/lib/config";

/**
 * The draft→approval loop, rendered as one panel whose contents depend on where
 * the post currently is. Approval is the client's call, so an admin pressing
 * approve is labelled as recording it on the client's behalf rather than being
 * shown the same button — `approved_by` stores whoever actually pressed it.
 */
export function ApprovalPanel({
  entryId,
  status,
  isAdmin,
  approvedBy,
  approvedAt,
  approverIsAdmin,
  hasMedia,
}: {
  entryId: string;
  status: CalendarStatus;
  isAdmin: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  approverIsAdmin: boolean;
  hasMedia: boolean;
}) {
  const [pending, start] = useTransition();
  const [showChanges, setShowChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function run(fn: () => Promise<void>) {
    setError(null);
    start(async () => {
      try {
        await fn();
        setShowChanges(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const changesForm = showChanges ? (
    <ChangesForm entryId={entryId} pending={pending} run={run} />
  ) : null;

  if (status === "approved") {
    return (
      <Panel className="border-emerald-200 bg-emerald-50/60">
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-semibold text-emerald-900">
          <Icon name="check" size={16} /> Approved
          {approvedBy && <span className="font-normal">by {approvedBy}</span>}
          {approvedAt && (
            <span className="font-normal text-emerald-900/70">· {relativeTime(approvedAt)}</span>
          )}
        </p>
        {approverIsAdmin && (
          <p className="mt-1 text-xs text-emerald-900/70">
            Recorded by the studio on the client&apos;s behalf.
          </p>
        )}
        {!showChanges && (
          <button
            onClick={() => setShowChanges(true)}
            disabled={pending}
            className="mt-3 text-xs font-medium text-emerald-900/80 underline underline-offset-2 hover:text-emerald-900"
          >
            Actually, I want changes
          </button>
        )}
        {changesForm}
        {error && <ErrorLine msg={error} />}
      </Panel>
    );
  }

  if (status === "awaiting_approval") {
    return (
      <Panel className="border-accent-200 bg-accent-50/60">
        <p className="text-sm font-semibold text-ink">
          {isAdmin ? "Waiting on the client to approve this." : "This draft is ready for your approval."}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {isAdmin
            ? "They'll see it on their dashboard. If they've already said yes elsewhere, you can record that here."
            : "Have a look at the draft above, then approve it or tell us what to change."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => run(() => approveEntry(entryId))} disabled={pending} className="btn-primary">
            <Icon name="check" size={16} />
            {isAdmin ? "Record client approval" : "Approve"}
          </button>
          <button onClick={() => setShowChanges((v) => !v)} disabled={pending} className="btn-ghost">
            {isAdmin ? "Log a change request" : "Request changes"}
          </button>
        </div>
        {changesForm}
        {error && <ErrorLine msg={error} />}
      </Panel>
    );
  }

  if (status === "changes_requested") {
    return (
      <Panel className="border-red-200 bg-red-50/50">
        <p className="text-sm font-semibold text-ink">Changes requested</p>
        <p className="mt-1 text-xs text-ink-muted">
          The reason is in the discussion below. Send it back over once it&apos;s reworked.
        </p>
        <button
          onClick={() => run(() => submitForApproval(entryId))}
          disabled={pending}
          className="btn-primary mt-3"
        >
          <Icon name="send" size={16} /> Send for approval again
        </button>
        {error && <ErrorLine msg={error} />}
      </Panel>
    );
  }

  // idea / drafted / posted — offer to start the loop.
  return (
    <Panel>
      <p className="text-sm font-semibold">Ready for the client?</p>
      <p className="mt-1 text-xs text-ink-muted">
        {hasMedia
          ? "Send this draft over for approval — they can approve it or ask for changes."
          : "Attach the draft media above first, then send it for approval."}
      </p>
      <button
        onClick={() => run(() => submitForApproval(entryId))}
        disabled={pending}
        className="btn-accent mt-3"
      >
        <Icon name="send" size={16} /> Send for approval
      </button>
      {error && <ErrorLine msg={error} />}
    </Panel>
  );
}

function Panel({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`card p-4 ${className}`}>{children}</section>;
}

function ChangesForm({
  entryId,
  pending,
  run,
}: {
  entryId: string;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  return (
    <form action={(fd) => run(() => requestChanges(entryId, fd))} className="mt-3 space-y-2">
      <label htmlFor={`chg_${entryId}`} className="label">
        What should change?
      </label>
      <textarea
        id={`chg_${entryId}`}
        name="body"
        rows={2}
        required
        placeholder="e.g. can we try a different hook line?"
        className="input"
      />
      <div className="flex justify-end">
        <button type="submit" className="btn-ghost" disabled={pending}>
          Send request
        </button>
      </div>
    </form>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <p role="alert" className="mt-2 text-sm text-red-700">
      {msg}
    </p>
  );
}
