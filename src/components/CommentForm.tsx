"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { addComment } from "@/app/app/ideas/actions";
import { Icon } from "@/components/icons";

function SendBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary shrink-0" disabled={pending} aria-label="Send comment">
      <Icon name="send" size={16} />
    </button>
  );
}

export function CommentForm({
  parentType,
  parentId,
}: {
  parentType: "idea" | "calendar";
  parentId: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const action = addComment.bind(null, parentType, parentId);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        name="body"
        required
        rows={1}
        placeholder="Write a comment…"
        className="input resize-none"
      />
      <SendBtn />
    </form>
  );
}
