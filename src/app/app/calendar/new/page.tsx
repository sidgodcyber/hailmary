import { requireAuth } from "@/lib/auth";
import { BackLink } from "@/components/ui";
import { NewCalendarForm } from "@/components/calendar/NewCalendarForm";

export default async function NewCalendarEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant!;
  const back = sp.m ? `/app/calendar?m=${sp.m}` : "/app/calendar";

  return (
    <div>
      <BackLink href={back} label="Calendar" />
      <h1 className="text-xl font-bold tracking-tight mb-4">New calendar entry</h1>
      <NewCalendarForm tenantId={tenant.id} defaultDate={sp.date} variant="card" />
    </div>
  );
}
