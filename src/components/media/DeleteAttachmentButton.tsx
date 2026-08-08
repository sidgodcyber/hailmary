"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteAttachment } from "@/app/app/attachments/actions";
import { Icon } from "@/components/icons";

export function DeleteAttachmentButton({ attachmentId }: { attachmentId: string }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  function remove() {
    start(async () => {
      await deleteAttachment(attachmentId);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[11px]">
        <button onClick={remove} disabled={pending} className="font-semibold text-red-700 hover:underline">
          {pending ? "Removing…" : "Remove"}
        </button>
        <button onClick={() => setConfirming(false)} disabled={pending} className="text-ink-muted hover:underline">
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="shrink-0 rounded p-0.5 text-ink-muted hover:bg-black/5 hover:text-ink"
      aria-label="Remove attachment"
    >
      <Icon name="trash" size={14} />
    </button>
  );
}
