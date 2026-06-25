import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getLocaux, actifs, auditLogs } from "@/lib/data";
import { AdminClient } from "@/components/AdminClient";
import { loadLocauxOverrides, mergeOverrides } from "@/lib/locaux-overrides";

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

  const baseLocaux = getLocaux({ includeArchived: true });
  const overrides = await loadLocauxOverrides();
  const mergedLocaux = mergeOverrides(baseLocaux, overrides);

  return <AdminClient locaux={mergedLocaux} actifs={actifs} auditLogs={auditLogs} />;
}
