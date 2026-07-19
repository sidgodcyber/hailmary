"use client";

import { useFormStatus } from "react-dom";
import { sendToCalendar } from "@/app/app/ideas/actions";
import { CALENDAR_CHANNELS, CALENDAR_CHANNEL_LABELS } from "@/lib/config";
import { Icon } from "@/components/icons";
import { toDateKey } from "@/lib/format";

function SendBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-accent w-full" disabled={pending}>
      <Icon name="send" size={16} /> {pending ? "Sending…" : "Send to calendar"}
    </button>
  );
}

export function SendToCalendar({ ideaId, defaultTitle }: { ideaId: string; defaultTitle: string }) {
  const action = sendToCalendar.bind(null, ideaId);
  const today = toDateKey(new Date());

  return (
    <details className="card p-4 group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-700">
          <Icon name="send" size={18} />
        </span>
        Send to calendar
        <span className="ml-auto text-ink-muted text-sm group-open:hidden">Open</span>
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <div>
          <label htmlFor="cal_title" className="label">
            Title
          </label>
          <input id="cal_title" name="title" defaultValue={defaultTitle} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cal_date" className="label">
              Date
            </label>
            <input id="cal_date" name="date" type="date" defaultValue={today} className="input" />
          </div>
          <div>
            <label htmlFor="cal_channel" className="label">
              Channel
            </label>
            <select id="cal_channel" name="channel" defaultValue="instagram" className="input">
              {CALENDAR_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CALENDAR_CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-ink-muted">The current brief travels with it to the calendar entry.</p>
        <SendBtn />
      </form>
    </details>
  );
}
