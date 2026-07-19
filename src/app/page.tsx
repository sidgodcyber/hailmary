import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export default async function Home() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  redirect(ctx.isAdmin ? "/admin" : "/app");
}
