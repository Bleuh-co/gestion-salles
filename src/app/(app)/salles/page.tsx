import { getLocaux, getUniqueFamilles, getUniqueEtages, getStats } from "@/lib/data";
import { SallesPageClient } from "@/components/SallesPageClient";

export const metadata = {
  title: "Gestion des Salles — ChanvHQ",
  description: "Vue d'ensemble des locaux de l'usine ChanvHQ du Groupe Chanv.",
};

export default function SallesPage() {
  const locaux = getLocaux();
  const familles = getUniqueFamilles();
  const etages = getUniqueEtages();
  const stats = getStats();

  return (
    <SallesPageClient
      locaux={locaux}
      familles={familles}
      etages={etages}
      stats={stats}
    />
  );
}
