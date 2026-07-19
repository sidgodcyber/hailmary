"use client";

import { useFormStatus } from "react-dom";
import { createCalendarEntry } from "@/app/app/calendar/actions";
import { CALENDAR_CHANNELS, CALENDAR_CHANNEL_LABELS } from "@/lib/config";
import { Icon } from "@/components/icons";
import { toDateKey } from "@/lib/format";

function AddBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Adding…" : "Add to calendar"}
    </button>
  );
}

export function NewCalendarForm({
  tenantId,
  defaultDate,
  variant = "inline",
}: {
  tenantId: string;
  defaultDate?: string;
  variant?: "inline" | "card";
}) {
  const date = defaultDate || toDateKey(new Date());

  const form = (
    <form action={createCalendarEntry} className="space-y-3">
      <input type="hidden" name="tenant" value={tenantId} />
      <div>
        <label htmlFor="c_title" className="label">
          Title
        </label>
        <input id="c_title" name="title" required placeholder="e.g. Launch teaser reel" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="c_date" className="label">
            Date
          </label>
          <input id="c_date" name="date" type="date" defaultValue={date} className="input" />
        </div>
        <div>
          <label htmlFor="c_channel" className="label">
            Channel
          </label>
          <select id="c_channel" name="channel" defaultValue="instagram" className="input">
            {CALENDAR_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CALENDAR_CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <AddBtn />
    </form>
  );

  if (variant === "card") return <div className="card p-5">{form}</div>;

  return (
    <details className="card p-4 group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon name="plus" size={18} />
        </span>
        New entry
      </summary>
      <div className="mt-4">{form}</div>
    </details>
  );
}
