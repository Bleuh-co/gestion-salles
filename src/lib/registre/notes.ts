// ============================================================
// Notes au registre et justification des écarts (lot 5) — module pur.
//
// Une note : un fait noté sur place (intervention, nettoyage,
// dégivrage, observation), datée du moment du fait. Une justification :
// l'explication d'un écart calculé. L'écart n'est pas écrit (il se
// recalcule) : la justification s'y rattache par le capteur, la
// grandeur et le moment, et reste lisible seule si l'écart change.
// ============================================================

import type { Grandeur } from "./mesures.ts";
import { estJour, instantMontreal } from "./temps.ts";

export const CATEGORIES_NOTE = ["intervention", "nettoyage", "degivrage", "observation"] as const;
export type CategorieNote = (typeof CATEGORIES_NOTE)[number];

export const MAX_TEXTE = 1000;
/** Une note se date jusqu'à un an en arrière. */
const RECUL_MAX_MS = 366 * 86_400_000;
/** Écart d'horloge toléré entre le téléphone et le serveur. */
const AVANCE_MAX_MS = 2 * 60_000;

/** Gestionnaires et administrateurs ; « Consulter » lit seulement (plan, 2.6). */
export function peutNoter(role: string | null | undefined): boolean {
  return role === "gestionnaire" || role === "admin" || role === "superadmin";
}

export type ErreurSaisie = "categorie" | "texte" | "quand" | "ecart";

export interface NoteLue {
  categorie: CategorieNote;
  texte: string;
  /** ms UTC */
  t: number;
}

function texteDe(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_TEXTE) : "";
}

/**
 * Corps d'une note : { categorie, texte, jour?, heure? } (heure de
 * Montréal). Sans jour : maintenant. Pas dans le futur, au plus un an
 * en arrière.
 */
export function lireNote(body: unknown, maintenant: number): NoteLue | { erreur: ErreurSaisie } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!CATEGORIES_NOTE.includes(b.categorie as CategorieNote)) return { erreur: "categorie" };
  const texte = texteDe(b.texte);
  if (!texte) return { erreur: "texte" };
  let t = maintenant;
  if (b.jour !== undefined && b.jour !== null && b.jour !== "") {
    if (!estJour(b.jour) || typeof b.heure !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.heure)) {
      return { erreur: "quand" };
    }
    t = instantMontreal(b.jour, b.heure);
  }
  if (t > maintenant + AVANCE_MAX_MS || t < maintenant - RECUL_MAX_MS) return { erreur: "quand" };
  return { categorie: b.categorie as CategorieNote, texte, t: Math.min(t, maintenant) };
}

/** Ce qui désigne un écart : capteur, grandeur, début et fin (ms). */
export interface RefEcart {
  sensorId: string;
  grandeur: Grandeur;
  debut: number;
  fin: number;
}

export interface JustificationLue {
  sensorId: string;
  grandeur: Grandeur;
  debut: number;
  texte: string;
}

/** Corps d'une justification : { sensorId, grandeur, debut, texte }. */
export function lireJustification(body: unknown, maintenant: number): JustificationLue | { erreur: ErreurSaisie } {
  const b = (body ?? {}) as Record<string, unknown>;
  const sensorId = typeof b.sensorId === "string" ? b.sensorId.trim() : "";
  const debut = typeof b.debut === "number" ? b.debut : Number.NaN;
  if (!sensorId || sensorId.length > 200 || (b.grandeur !== "c" && b.grandeur !== "h")) return { erreur: "ecart" };
  if (!Number.isFinite(debut) || debut > maintenant) return { erreur: "ecart" };
  const texte = texteDe(b.texte);
  if (!texte) return { erreur: "texte" };
  return { sensorId, grandeur: b.grandeur, debut, texte };
}

/**
 * Une justification vise un écart s'il s'agit du même capteur et de la
 * même grandeur, et que les deux périodes se chevauchent : un écart en
 * cours qui s'allonge, ou recalculé un peu autrement, garde sa
 * justification.
 */
export function viseEcart(j: RefEcart, e: RefEcart): boolean {
  return j.sensorId === e.sensorId && j.grandeur === e.grandeur && j.debut <= e.fin && e.debut <= j.fin;
}
