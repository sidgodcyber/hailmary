import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { NewCalendarForm } from "@/components/calendar/NewCalendarForm";
import { MonthGrid, type CalEntry } from "@/components/calendar/MonthGrid";
import {
  addMonths,
  buildWeeks,
  monthKey,
  monthLabel,
  monthRange,
  parseMonthParam,
} from "@/lib/calendar";
import { CALENDAR_CHANNEL_LABELS, CALENDAR_STATUS_LABELS, type CalendarStatus } from "@/lib/config";
import { formatDate } from "@/lib/format";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant!;
  const supabase = await createClient();

  const sel = parseMonthParam(sp.m);
  const { start, end } = monthRange(sel);

  const { data } = await supabase
    .from("calendar_entries")
    .select("id, title, date, channel, status")
    .eq("tenant_id", tenant.id)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });
  const entries = (data ?? []) as CalEntry[];

  const byDay = new Map<string, CalEntry[]>();
  for (const e of entries) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }
  // ensure padded days exist as keys is unnecessary; MonthGrid reads by key
  void buildWeeks;

  const prev = monthKey(addMonths(sel, -1));
  const next = monthKey(addMonths(sel, 1));
  const cur = monthKey(sel);

  return (
    <div className="space-y-4">
      <PageHeader title="Content calendar" subtitle="Plan posts together — both sides can add and move entries." />

      <div className="flex items-center justify-between">
        <Link href={`/app/calendar?m=${prev}`} className="btn-ghost !px-3" aria-label="Previous month">
          <Icon name="back" size={16} />
        </Link>
        <h2 className="font-semibold">{monthLabel(sel)}</h2>
        <Link href={`/app/calendar?m=${next}`} className="btn-ghost !px-3" aria-label="Next month">
          <Icon name="back" size={16} className="rotate-180" />
        </Link>
      </div>

      <MonthGrid sel={sel} entriesByDay={byDay} monthParam={cur} />

      <NewCalendarForm tenantId={tenant.id} />

      <section>
        <h2 className="font-semibold mb-2">This month</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing scheduled yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id}>
                <Link href={`/app/calendar/${e.id}?m=${cur}`} className="card block p-3.5 hover:shadow-soft transition-shadow">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums text-ink-muted w-12 shrink-0">
                      {formatDate(e.date)}
                    </span>
                    <span className="font-medium truncate flex-1">{e.title}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 pl-14">
                    <Badge tone={e.channel}>{CALENDAR_CHANNEL_LABELS[e.channel]}</Badge>
                    <Badge tone={e.status === "idea" ? "idea_cal" : e.status}>
                      {CALENDAR_STATUS_LABELS[e.status as CalendarStatus]}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
