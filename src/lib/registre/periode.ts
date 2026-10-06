// ============================================================
// Périodes de consultation et d'export (module pur).
// Les bornes sont des jours de Montréal : « 7 j » = aujourd'hui et
// les 6 jours d'avant, de 0 h à maintenant.
// ============================================================

import { ajouterJours, debutJour, estJour, finJour, jourDe } from "./temps.ts";

export const CODES_PERIODE = ["24h", "7j", "30j", "3m", "12m", "tout", "perso"] as const;
export type CodePeriode = (typeof CODES_PERIODE)[number];

const JOURS: Record<string, number> = { "7j": 7, "30j": 30, "3m": 92, "12m": 365 };
/** Période personnalisée la plus longue (jours). */
export const MAX_JOURS = 400;

export interface Bornes {
  code: CodePeriode;
  /** ms UTC, inclus */
  du: number;
  /** ms UTC, exclu */
  au: number;
  duJour: string;
  auJour: string;
}

/**
 * Bornes d'une période. `debutTout` = début de « Tout » (ouverture du
 * registre ou première mesure de la salle, la plus ancienne des deux).
 */
export function bornesPeriode(
  code: string | null | undefined,
  du: string | null | undefined,
  au: string | null | undefined,
  maintenant: number,
  debutTout: number
): Bornes {
  const aujourdHui = jourDe(maintenant);
  if (code === "24h") {
    const d = maintenant - 24 * 3600_000;
    return { code: "24h", du: d, au: maintenant + 60_000, duJour: jourDe(d), auJour: aujourdHui };
  }
  if (code && code in JOURS) {
    const duJour = ajouterJours(aujourdHui, -(JOURS[code] - 1));
    return { code: code as CodePeriode, du: debutJour(duJour), au: finJour(aujourdHui), duJour, auJour: aujourdHui };
  }
  if (code === "perso" || (!code && (du || au))) {
    let a = estJour(au) && au! <= aujourdHui ? au! : aujourdHui;
    let d = estJour(du) ? du! : ajouterJours(a, -29);
    if (d > a) [d, a] = [a, d];
    if (ajouterJours(d, MAX_JOURS - 1) < a) d = ajouterJours(a, -(MAX_JOURS - 1));
    return { code: "perso", du: debutJour(d), au: finJour(a), duJour: d, auJour: a };
  }
  // « Tout »
  const duJour = jourDe(Math.min(debutTout, maintenant));
  return { code: "tout", du: debutJour(duJour), au: finJour(aujourdHui), duJour, auJour: aujourdHui };
}

/** Pas d'agrégation des courbes selon la durée affichée. */
export function pasCourbe(dureeMs: number): "brut" | "heure" | "jour" {
  if (dureeMs <= 2.5 * 86_400_000) return "brut";
  if (dureeMs <= 93 * 86_400_000) return "heure";
  return "jour";
}
