import { Suspense } from "react";
import { getSession } from "@/lib/auth-server";
import { peutNoter } from "@/lib/registre/notes";
import { EntretienClient } from "@/components/entretien/EntretienClient";

// Section « Entretien » : calendrier, interventions, règles, équipe, reprise de la GMAO.

export const dynamic = "force-dynamic";

export default async function Page() {
  const s = await getSession();
  const admin = s?.role === "admin" || s?.role === "superadmin";
  return (
    <Suspense>
      <EntretienClient admin={admin} gestionnaire={peutNoter(s?.role)} />
    </Suspense>
  );
}
