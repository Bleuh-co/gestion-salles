import { getLocaux } from "@/lib/data";
import { loadLocauxOverrides, mergeOverrides } from "@/lib/locaux-overrides";
import { readFamilleColors } from "@/lib/sheets-sync";
import { FAMILLE_COLORS_FALLBACK } from "@/lib/types";
import { BatchSignClient } from "./BatchSignClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Impression batch — Affiches de salles",
  description: "Sélectionnez plusieurs salles pour générer un PDF d'affiches imprimables.",
};

export default async function BatchSignPage() {
  const baseLocaux = getLocaux();
  const overrides = await loadLocauxOverrides();
  const allLocaux = mergeOverrides(baseLocaux, overrides);

  // Load famille colors from Sheet (with fallback)
  let sheetColors: Record<string, string> = {};
  try {
    sheetColors = await readFamilleColors();
  } catch {
    // Fallback to constants
  }
  const familleColors = { ...FAMILLE_COLORS_FALLBACK, ...sheetColors };

  return <BatchSignClient allLocaux={allLocaux} familleColors={familleColors} />;
}
