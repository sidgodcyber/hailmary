import { requireAuth } from "@/lib/auth";
import { BackLink } from "@/components/ui";
import { NewIdeaForm } from "@/components/ideas/NewIdeaForm";

export default async function NewIdeaPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireAuth();
  const tenant = ctx.activeTenant!;
  const type = sp.type === "reference" ? "reference" : "idea";

  return (
    <div>
      <BackLink href="/app/ideas" label="Ideas & briefs" />
      <h1 className="text-xl font-bold tracking-tight mb-4">
        {type === "reference" ? "Add a reference brief" : "New idea"}
      </h1>
      <div className="card p-5">
        <NewIdeaForm tenantId={tenant.id} type={type} />
      </div>
    </div>
  );
}
