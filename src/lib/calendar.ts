import { toDateKey } from "@/lib/format";

export type MonthSel = { year: number; month: number }; // month is 0-based

export function parseMonthParam(m?: string): MonthSel {
  const now = new Date();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return { year: y!, month: mo! - 1 };
  }
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function monthKey({ year, month }: MonthSel): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function monthLabel({ year, month }: MonthSel): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
}

export function addMonths(sel: MonthSel, delta: number): MonthSel {
  const d = new Date(sel.year, sel.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** First and last calendar day of the month as yyyy-mm-dd (for range queries). */
export function monthRange(sel: MonthSel): { start: string; end: string } {
  const start = new Date(sel.year, sel.month, 1);
  const end = new Date(sel.year, sel.month + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export type DayCell = { date: Date; key: string; inMonth: boolean; isToday: boolean };

/** Weeks (Sunday-start) covering the month, padded with adjacent days. */
export function buildWeeks(sel: MonthSel): DayCell[][] {
  const first = new Date(sel.year, sel.month, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // back up to Sunday
  const todayKey = toDateKey(new Date());

  const weeks: DayCell[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = toDateKey(cursor);
      week.push({
        date: new Date(cursor),
        key,
        inMonth: cursor.getMonth() === sel.month,
        isToday: key === todayKey,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    // stop after we've passed the month and completed a week
    if (cursor.getMonth() !== sel.month && cursor > first && w >= 3) {
      const lastOfMonth = new Date(sel.year, sel.month + 1, 0);
      if (cursor > lastOfMonth) break;
    }
  }
  return weeks;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
