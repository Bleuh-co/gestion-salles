// ============================================================
// Calendrier de l'entretien : échéances, fenêtres, avis du jour.
// Module pur (testé par npm test) : jours de Montréal « AAAA-MM-JJ ».
// ============================================================

import { ajouterJours } from "../registre/temps.ts";
import type { Frequence, Intervention, ModeCalcul, StatutIntervention, UniteFrequence } from "./types.ts";

const pad = (n: number) => String(n).padStart(2, "0");

function parts(jour: string): [number, number, number] {
  const [y, m, d] = jour.split("-").map(Number);
  return [y, m, d];
}

function joursDuMois(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Jour + n mois ; le jour du mois (ou `ancre`) est borné à la longueur du mois : 31 janv. + 1 mois = 28 ou 29 févr. */
export function ajouterMois(jour: string, n: number, ancre?: number): string {
  const [y, m, d] = parts(jour);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(ancre ?? d, joursDuMois(ny, nm));
  return `${ny}-${pad(nm)}-${pad(nd)}`;
}

export function ajouterPeriode(jour: string, n: number, unite: UniteFrequence, ancre?: number): string {
  switch (unite) {
    case "jour":
      return ajouterJours(jour, n);
    case "semaine":
      return ajouterJours(jour, 7 * n);
    case "mois":
      return ajouterMois(jour, n, ancre);
    case "an":
      return ajouterMois(jour, 12 * n, ancre);
  }
}

/** Nombre de jours de du à au (positif si au est après du). */
export function ecartJours(du: string, au: string): number {
  const [y1, m1, d1] = parts(du);
  const [y2, m2, d2] = parts(au);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Samedi ou dimanche. */
export function estFinDeSemaine(jour: string): boolean {
  const [y, m, d] = parts(jour);
  const j = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return j === 0 || j === 6;
}

export function estLundi(jour: string): boolean {
  const [y, m, d] = parts(jour);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
}

/** Durée approximative d'une période, en jours. */
export function dureePeriode(f: Frequence): number {
  if (f.type === "saisonniere") return 365;
  if (f.type === "ponctuelle") return 365;
  const n = Math.max(1, f.n);
  return { jour: 1, semaine: 7, mois: 30, an: 365 }[f.unite] * n;
}

/** Fenêtre par défaut : la tâche apparaît 30 jours avant une annuelle, 7 avant une mensuelle… */
export function fenetreParDefaut(f: Frequence | null): number {
  if (!f) return 30;
  if (f.type === "ponctuelle") return 14;
  const p = dureePeriode(f);
  if (p <= 1) return 0;
  if (p <= 7) return 2;
  if (p <= 31) return 7;
  if (p <= 92) return 14;
  if (p <= 183) return 21;
  return 30;
}

export function fenetreDe(r: { fenetreJours: number | null; frequence: Frequence | null }): number {
  return r.fenetreJours != null && r.fenetreJours >= 0 ? Math.round(r.fenetreJours) : fenetreParDefaut(r.frequence);
}

function moisSaison(mois: number[]): [number, number] {
  const ok = [...new Set(mois.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
  if (!ok.length) return [1, 12];
  return [ok[0], ok[ok.length - 1]];
}

/** Échéance d'une saison pour une année : dernier jour du dernier mois permis. */
export function echeanceSaison(mois: number[], annee: number): string {
  const [, fin] = moisSaison(mois);
  return `${annee}-${pad(fin)}-${pad(joursDuMois(annee, fin))}`;
}

/** Jour où la tâche apparaît : N jours avant l'échéance ; pour une saison, le 1er jour du premier mois permis. */
export function ouvertureDe(
  echeance: string,
  r: { fenetreJours: number | null; frequence: Frequence | null }
): string {
  if (r.frequence?.type === "saisonniere") {
    const [debut] = moisSaison(r.frequence.mois);
    const [y] = parts(echeance);
    return `${y}-${pad(debut)}-01`;
  }
  return ajouterJours(echeance, -fenetreDe(r));
}

/**
 * Échéance suivante après une occurrence faite le `faitLe` (D5).
 *  - depuis la date prévue (défaut) : la série garde son calendrier ; on prend
 *    la première date de la série après l'échéance ET après le jour où c'est fait
 *    (une inspection faite en retard ne décale pas les suivantes ; un retard de
 *    plus d'une période saute les dates déjà passées) ;
 *  - depuis la date faite : une période après le jour où c'est fait (usure, filtres).
 * null = plus d'échéance (ponctuelle).
 */
export function suivante(
  r: { frequence: Frequence | null; calcul: ModeCalcul },
  echeance: string,
  faitLe: string
): string | null {
  const f = r.frequence;
  if (!f || f.type === "ponctuelle") return null;
  const borne = faitLe > echeance ? faitLe : echeance;
  if (f.type === "saisonniere") {
    let y = parts(borne)[0];
    for (;;) {
      const e = echeanceSaison(f.mois, y);
      if (e > borne) return e;
      y += 1;
    }
  }
  const n = Math.max(1, Math.round(f.n));
  if (r.calcul === "faite") return ajouterPeriode(faitLe, n, f.unite);
  const ancre = parts(echeance)[2];
  for (let k = 1; k < 5000; k++) {
    const e = ajouterPeriode(echeance, k * n, f.unite, ancre);
    if (e > borne) return e;
  }
  return null;
}

/** Les échéances d'une règle de `du` à `au` inclus (calendrier V7), à partir de sa prochaine échéance. */
export function echeancesEntre(
  r: { frequence: Frequence | null; calcul: ModeCalcul; prochaine: string | null },
  du: string,
  au: string,
  max = 400
): string[] {
  if (!r.prochaine || !r.frequence) return [];
  const out: string[] = [];
  let e: string | null = r.prochaine;
  // Calcul « depuis la date faite » : on suppose chaque occurrence faite à son échéance.
  const regle = { frequence: r.frequence, calcul: "prevue" as ModeCalcul };
  while (e && e <= au && out.length < max) {
    if (e >= du) out.push(e);
    e = suivante(regle, e, e);
  }
  return out;
}

/** Jours avant l'échéance : positif = à venir, 0 = aujourd'hui, négatif = jours de retard. */
export function joursAvant(echeance: string, aujourdHui: string): number {
  return ecartJours(aujourdHui, echeance);
}

// ============================================================
// Avis du jour (D2) : J−7 et jour J pour l'intervenant, relance à
// J+1, escalade au responsable à J+7. Au plus un avis par tâche et
// par jour ; rien la fin de semaine, sauf une priorité 0 ou 1.
// ============================================================

export type EtapeAvis = "j7" | "j0" | "j1" | "escalade";

const AVEC_TACHE: StatutIntervention[] = ["a_faire", "en_cours", "en_attente"];

export function urgente(iv: Pick<Intervention, "priorite">): boolean {
  return iv.priorite === 0 || iv.priorite === 1;
}

export function avisDuJour(
  iv: Pick<Intervention, "statut" | "echeance" | "avis" | "dernierAvis" | "priorite" | "tacheId">,
  aujourdHui: string
): EtapeAvis | null {
  if (!AVEC_TACHE.includes(iv.statut) || !iv.echeance || !iv.tacheId) return null;
  if (iv.dernierAvis === aujourdHui) return null;
  if (estFinDeSemaine(aujourdHui) && !urgente(iv)) return null;
  const d = joursAvant(iv.echeance, aujourdHui);
  const deja = iv.avis ?? {};
  if (d <= -7) return deja.escalade ? null : "escalade";
  if (d <= -1) return deja.j1 ? null : "j1";
  if (d === 0) return deja.j0 ? null : "j0";
  if (d <= 7) return deja.j7 || deja.j0 ? null : "j7";
  return null;
}

/** Une préventive dont la fenêtre est ouverte et qui n'a pas encore de tâche. */
export function fenetreOuverte(ouverture: string | null, aujourdHui: string): boolean {
  return !!ouverture && ouverture <= aujourdHui;
}

/** Échéance d'un problème signalé selon sa priorité (0–1 : le jour même ; 2 : 24 h ; 3 : 3 jours…). */
export function echeanceProbleme(priorite: number, aujourdHui: string, delais: Record<number, number>): string {
  return ajouterJours(aujourdHui, delais[priorite] ?? 3);
}
