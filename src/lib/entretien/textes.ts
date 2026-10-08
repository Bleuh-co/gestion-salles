// ============================================================
// Textes de l'entretien hors React (version imprimable, export) :
// reçoivent la fonction de traduction.
// ============================================================

import type { Frequence, ModeCalcul } from "./types.ts";

type T = (key: string, vars?: Record<string, string | number>) => string;

export function frequenceSeule(f: Frequence | null | undefined, t: T): string {
  if (!f) return t("entretien.freq.aucune");
  if (f.type === "ponctuelle") return t("entretien.freq.ponctuelle");
  if (f.type === "saisonniere") return t("entretien.freq.saison", { mois: f.mois.join(", ") });
  if (f.n === 1) return t(`entretien.freq.chaque.${f.unite}`);
  if (f.unite === "mois" && f.n === 6) return t("entretien.freq.semestrielle");
  if (f.unite === "mois" && f.n === 3) return t("entretien.freq.trimestrielle");
  return t(`entretien.freq.tous.${f.unite}`, { n: f.n });
}

export function frequenceTexte(r: { frequence: Frequence | null; calcul: ModeCalcul }, t: T): string {
  return `${frequenceSeule(r.frequence, t)}, ${t(r.calcul === "faite" ? "regle.calculFaite" : "regle.calculPrevue")}`;
}
