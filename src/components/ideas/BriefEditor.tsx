"use client";

import { useFormStatus } from "react-dom";
import { updateBrief } from "@/app/app/ideas/actions";

type Brief = {
  brief_concept: string | null;
  brief_hook: string | null;
  brief_outline: string | null;
  brief_caption: string | null;
};

const FIELDS: { name: keyof Brief; label: string; rows: number; placeholder: string }[] = [
  { name: "brief_concept", label: "Concept", rows: 2, placeholder: "The core idea in a line or two" },
  { name: "brief_hook", label: "Hook", rows: 2, placeholder: "The first 3 seconds / opening line" },
  { name: "brief_outline", label: "Outline", rows: 4, placeholder: "Beat-by-beat / shot list" },
  { name: "brief_caption", label: "Caption direction", rows: 3, placeholder: "Tone, CTA, hashtags direction" },
];

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save brief"}
    </button>
  );
}

export function BriefEditor({
  ideaId,
  brief,
  updatedLabel,
}: {
  ideaId: string;
  brief: Brief;
  updatedLabel: string | null;
}) {
  const action = updateBrief.bind(null, ideaId);
  return (
    <form action={action} className="space-y-3">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label htmlFor={f.name} className="label">
            {f.label}
          </label>
          <textarea
            id={f.name}
            name={f.name}
            rows={f.rows}
            defaultValue={brief[f.name] ?? ""}
            placeholder={f.placeholder}
            className="input"
          />
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          {updatedLabel ? `Last updated ${updatedLabel}` : "Editable by both of us."}
        </p>
        <SaveBtn />
      </div>
    </form>
  );
}
