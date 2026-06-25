import { getLocaux, getUniqueFamilles, getUniqueEtages, getStats } from "@/lib/data";
import { getSession } from "@/lib/auth-server";
import { SallesPageClient } from "@/components/SallesPageClient";
import { loadLocauxOverrides, mergeOverrides } from "@/lib/locaux-overrides";

export const metadata = {
  title: "Gestion des Salles — ChanvHQ",
  description: "Vue d'ensemble des locaux de l'usine ChanvHQ du Groupe Chanv.",
};

export default async function SallesPage() {
  const baseLocaux = getLocaux();
  const overrides = await loadLocauxOverrides();
  const locaux = mergeOverrides(baseLocaux, overrides);
  const familles = getUniqueFamilles();
  const etages = getUniqueEtages();
  const stats = getStats();
  const session = await getSession();
  const isAdmin = session?.role === "admin" || session?.role === "superadmin";

  return (
    <SallesPageClient
      locaux={locaux}
      familles={familles}
      etages={etages}
      stats={stats}
      isAdmin={isAdmin}
    />
  );
}

