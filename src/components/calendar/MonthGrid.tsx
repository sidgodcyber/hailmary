import Link from "next/link";
import { buildWeeks, WEEKDAYS, type MonthSel } from "@/lib/calendar";
import type { CalendarChannel } from "@/lib/config";

export type CalEntry = {
  id: string;
  title: string;
  date: string;
  channel: CalendarChannel;
  status: string;
};

const CHANNEL_DOT: Record<string, string> = {
  instagram: "bg-pink-500",
  whatsapp: "bg-emerald-500",
  other: "bg-stone-400",
};

export function MonthGrid({
  sel,
  entriesByDay,
  monthParam,
}: {
  sel: MonthSel;
  entriesByDay: Map<string, CalEntry[]>;
  monthParam: string;
}) {
  const weeks = buildWeeks(sel);

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[color:var(--line)] bg-cream/60">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            {d.charAt(0)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((cell) => {
          const items = entriesByDay.get(cell.key) ?? [];
          return (
            <div
              key={cell.key}
              className={`min-h-[68px] border-b border-r border-[color:var(--line)] p-1 ${
                cell.inMonth ? "" : "bg-cream/40"
              }`}
            >
              <Link
                href={`/app/calendar/new?date=${cell.key}&m=${monthParam}`}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  cell.isToday
                    ? "bg-brand-600 text-white"
                    : cell.inMonth
                    ? "text-ink hover:bg-black/5"
                    : "text-ink-muted/50"
                }`}
              >
                {cell.date.getDate()}
              </Link>
              <div className="mt-0.5 space-y-0.5">
                {items.slice(0, 3).map((e) => (
                  <Link
                    key={e.id}
                    href={`/app/calendar/${e.id}?m=${monthParam}`}
                    className="flex items-center gap-1 rounded bg-white px-1 py-0.5 text-[10px] leading-tight shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:bg-brand-50"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CHANNEL_DOT[e.channel] ?? CHANNEL_DOT.other}`} />
                    <span className="truncate">{e.title}</span>
                  </Link>
                ))}
                {items.length > 3 && (
                  <p className="px-1 text-[10px] text-ink-muted">+{items.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
