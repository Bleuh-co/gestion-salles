import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getLocaux } from "@/lib/repo/locaux";
import { getAllActifs } from "@/lib/repo/actifs";
import { getAuditLogs } from "@/lib/repo/audit";
import { getFamilleColors, getLocalFormOptions } from "@/lib/repo/config";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

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

  const [locaux, actifs, auditLogs, familleColors, formOptions] = await Promise.all([
    getLocaux({ includeArchived: true }),
    getAllActifs(),
    getAuditLogs().catch(() => []),
    getFamilleColors(),
    getLocalFormOptions(),
  ]);

  return (
    <AdminClient
      locaux={locaux}
      actifs={actifs}
      auditLogs={auditLogs}
      isSuperadmin={session.role === "superadmin"}
      familleColors={familleColors}
      formOptions={formOptions}
    />
  );
}
