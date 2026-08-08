"use client";

import { useFormStatus } from "react-dom";
import { updateCalendarEntry } from "@/app/app/calendar/actions";
import {
  CALENDAR_CHANNELS,
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_MANUAL_STATUSES,
  CALENDAR_STATUS_LABELS,
  type CalendarChannel,
  type CalendarStatus,
} from "@/lib/config";

type Entry = {
  id: string;
  title: string;
  date: string;
  channel: CalendarChannel;
  status: CalendarStatus;
};

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export function CalendarEditor({ entry }: { entry: Entry }) {
  const action = updateCalendarEntry.bind(null, entry.id);
  return (
    <form action={action} className="space-y-3">
      <div>
        <label htmlFor="e_title" className="label">
          Title
        </label>
        <input id="e_title" name="title" defaultValue={entry.title} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="e_date" className="label">
            Date
          </label>
          <input id="e_date" name="date" type="date" defaultValue={entry.date} className="input" />
        </div>
        <div>
          <label htmlFor="e_channel" className="label">
            Channel
          </label>
          <select id="e_channel" name="channel" defaultValue={entry.channel} className="input">
            {CALENDAR_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CALENDAR_CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="e_status" className="label">
          Status
        </label>
        {/* Only the plain statuses live here. Awaiting-approval / approved /
            changes-requested come from the approval panel, so "Approved" can
            never be self-assigned from a dropdown. The current status is still
            listed (disabled) when the post is mid-approval. */}
        <select id="e_status" name="status" defaultValue={entry.status} className="input">
          {!(CALENDAR_MANUAL_STATUSES as readonly string[]).includes(entry.status) && (
            <option value={entry.status} disabled>
              {CALENDAR_STATUS_LABELS[entry.status]} (set by approval)
            </option>
          )}
          {CALENDAR_MANUAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CALENDAR_STATUS_LABELS[s as CalendarStatus]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end">
        <SaveBtn />
      </div>
    </form>
  );
}
