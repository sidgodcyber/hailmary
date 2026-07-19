"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateIdeaStatus } from "@/app/app/ideas/actions";
import { IDEA_STATUSES, IDEA_STATUS_LABELS, type IdeaStatus } from "@/lib/config";

export function StatusControl({ ideaId, status }: { ideaId: string; status: IdeaStatus }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">Status</span>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          start(async () => {
            await updateIdeaStatus(ideaId, next);
            router.refresh();
          });
        }}
        className="rounded-lg border border-[color:var(--line)] bg-white px-2.5 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        {IDEA_STATUSES.map((s) => (
          <option key={s} value={s}>
            {IDEA_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}
