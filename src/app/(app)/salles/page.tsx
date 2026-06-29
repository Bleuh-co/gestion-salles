import { getLocaux, getUniqueFamilles, getUniqueEtages, getStats } from "@/lib/data";
import { getSession } from "@/lib/auth-server";
import { SallesPageClient } from "@/components/SallesPageClient";
import { loadLocauxOverrides, mergeOverrides } from "@/lib/locaux-overrides";
import { readFamilleColors } from "@/lib/sheets-sync";
import { FAMILLE_COLORS_FALLBACK } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  // Charger les couleurs depuis le Google Sheet, fallback sur les constantes
  let sheetColors: Record<string, string> = {};
  try {
    sheetColors = await readFamilleColors();
  } catch (e) {
    console.warn("[SallesPage] readFamilleColors failed, using fallback", e);
  }
  const familleColors = { ...FAMILLE_COLORS_FALLBACK, ...sheetColors };

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
