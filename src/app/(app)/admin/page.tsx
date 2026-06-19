import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { locaux, actifs, auditLogs } from "@/lib/data";
import { AdminClient } from "@/components/AdminClient";

export const metadata = {
  title: "Administration — Gestion Salles",
  description: "Administration des locaux et actifs ChanvHQ.",
};

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Only admin and superadmin can access
  if (session.role !== "admin" && session.role !== "superadmin") {
    redirect("/salles");
  }

  return <AdminClient locaux={locaux} actifs={actifs} auditLogs={auditLogs} />;
}
