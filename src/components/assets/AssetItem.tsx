"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { setAssetStatus, updateAsset } from "@/app/app/assets/actions";
import { Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ASSET_STATUSES, ASSET_STATUS_LABELS, type AssetStatus } from "@/lib/config";
import { formatDate } from "@/lib/format";

export type Asset = {
  id: string;
  label: string;
  drive_url: string | null;
  status: AssetStatus;
  note: string;
  linked_calendar_entry_id: string | null;
  updated_at: string;
};

type CalRef = { id: string; title: string; date: string };

function nextStatus(s: AssetStatus): AssetStatus | null {
  const i = ASSET_STATUSES.indexOf(s);
  return i >= 0 && i < ASSET_STATUSES.length - 1 ? ASSET_STATUSES[i + 1]! : null;
}

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function AssetItem({ asset, calendarEntries }: { asset: Asset; calendarEntries: CalRef[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const next = nextStatus(asset.status);
  const updateAction = updateAsset.bind(null, asset.id);

  function advance() {
    if (!next) return;
    start(async () => {
      await setAssetStatus(asset.id, next);
      router.refresh();
    });
  }

  return (
    <div className={`card p-4 ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{asset.label}</p>
          {asset.drive_url && (
            <a
              href={asset.drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 text-sm link"
            >
              <Icon name="link" size={14} /> Open in Drive
            </a>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <Badge tone={`asset_${asset.status}`}>{ASSET_STATUS_LABELS[asset.status]}</Badge>
            <span className="text-xs text-ink-muted">updated {formatDate(asset.updated_at)}</span>
          </div>
        </div>
        {next && (
          <button
            onClick={advance}
            disabled={pending}
            className="btn-ghost shrink-0 !px-3 text-xs"
            aria-label={`Mark as ${ASSET_STATUS_LABELS[next]}`}
          >
            {ASSET_STATUS_LABELS[next]} <Icon name="arrowRight" size={14} />
          </button>
        )}
      </div>

      <details className="mt-2 group">
        <summary className="cursor-pointer list-none text-xs font-medium text-ink-muted hover:text-ink">
          {asset.note || asset.linked_calendar_entry_id ? "Note & link ✓" : "Add note / link to a post"}
        </summary>
        <form action={updateAction} className="mt-3 space-y-3">
          <div>
            <label htmlFor={`note_${asset.id}`} className="label">
              Note
            </label>
            <textarea
              id={`note_${asset.id}`}
              name="note"
              rows={2}
              defaultValue={asset.note}
              placeholder="Anything worth remembering about this footage…"
              className="input"
            />
          </div>
          <div>
            <label htmlFor={`link_${asset.id}`} className="label">
              Used in
            </label>
            <select
              id={`link_${asset.id}`}
              name="linked_calendar_entry_id"
              defaultValue={asset.linked_calendar_entry_id ?? ""}
              className="input"
            >
              <option value="">— not linked —</option>
              {calendarEntries.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatDate(c.date)} · {c.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <SaveBtn />
          </div>
        </form>
      </details>
    </div>
  );
}
