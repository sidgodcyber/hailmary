"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createIdea } from "@/app/app/ideas/actions";
import { REF_LIKE_TAGS } from "@/lib/config";
import { Icon } from "@/components/icons";

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function NewIdeaForm({
  tenantId,
  type,
}: {
  tenantId: string;
  type: "idea" | "reference";
}) {
  const isRef = type === "reference";
  const [tags, setTags] = useState<Record<string, boolean>>({});

  return (
    <form action={createIdea} className="space-y-4">
      <input type="hidden" name="tenant" value={tenantId} />
      <input type="hidden" name="type" value={type} />

      {isRef && (
        <div>
          <label htmlFor="ref_url" className="label">
            Reel / post link
          </label>
          <input
            id="ref_url"
            name="ref_url"
            type="url"
            inputMode="url"
            placeholder="https://instagram.com/reel/…"
            className="input"
          />
          <p className="mt-1 text-xs text-ink-muted">Pasted as a plain tappable link — no embed needed.</p>
        </div>
      )}

      <div>
        <label htmlFor="title" className="label">
          {isRef ? "Give it a name" : "Idea title"}
        </label>
        <input
          id="title"
          name="title"
          required
          placeholder={isRef ? "e.g. Fast-cut unboxing hook" : "e.g. Behind-the-scenes on packaging"}
          className="input"
        />
      </div>

      {!isRef && (
        <div>
          <label htmlFor="body" className="label">
            Details <span className="font-normal normal-case text-ink-muted">(optional)</span>
          </label>
          <textarea id="body" name="body" rows={5} placeholder="Braindump anything…" className="input" />
        </div>
      )}

      {isRef && (
        <>
          <div>
            <span className="label">What we like</span>
            <div className="flex flex-wrap gap-2 mb-2">
              {REF_LIKE_TAGS.map((t) => {
                const on = !!tags[t];
                return (
                  <label
                    key={t}
                    className={`chip cursor-pointer border capitalize ${
                      on
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-ink-muted border-[color:var(--line)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name={`tag_${t}`}
                      className="sr-only"
                      checked={on}
                      onChange={(e) => setTags((prev) => ({ ...prev, [t]: e.target.checked }))}
                    />
                    {t}
                  </label>
                );
              })}
            </div>
            <textarea
              name="ref_likes"
              rows={3}
              placeholder="What specifically works — the hook, pacing, the audio…"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="maps_to_product" className="label">
              Maps to which product / offer?
            </label>
            <input
              id="maps_to_product"
              name="maps_to_product"
              placeholder="e.g. The leather strap line"
              className="input"
            />
          </div>

          <div>
            <label htmlFor="ref_notes" className="label">
              Notes <span className="font-normal normal-case text-ink-muted">(optional)</span>
            </label>
            <textarea id="ref_notes" name="ref_notes" rows={2} className="input" />
          </div>
        </>
      )}

      <SubmitBtn label={isRef ? "Save reference" : "Post idea"} />
      <p className="text-center text-xs text-ink-muted">
        <Icon name="check" size={12} className="inline" /> You can shape it into a full brief on the next screen.
      </p>
    </form>
  );
}
