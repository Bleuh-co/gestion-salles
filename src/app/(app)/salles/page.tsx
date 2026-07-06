import { getLocaux, getUniqueFamilles, getUniqueEtages, getLocauxStats } from "@/lib/repo/locaux";
import { getAllActifs } from "@/lib/repo/actifs";
import { getFamilleColors } from "@/lib/repo/config";
import { getSession } from "@/lib/auth-server";
import { SallesPageClient } from "@/components/SallesPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gestion des Salles — ChanvHQ",
  description: "Vue d'ensemble des locaux de l'usine ChanvHQ du Groupe Chanv.",
};

export default async function SallesPage() {
  const [locaux, familles, etages, locauxStats, actifs, familleColors, session] =
    await Promise.all([
      getLocaux(),
      getUniqueFamilles(),
      getUniqueEtages(),
      getLocauxStats(),
      getAllActifs(),
      getFamilleColors(),
      getSession(),
    ]);

  const stats = { ...locauxStats, totalActifs: actifs.length };
  const isAdmin = session?.role === "admin" || session?.role === "superadmin";

  return (
    <SallesPageClient
      locaux={locaux}
      familles={familles}
      etages={etages}
      stats={stats}
      isAdmin={isAdmin}
      familleColors={familleColors}
    />
  );
}
