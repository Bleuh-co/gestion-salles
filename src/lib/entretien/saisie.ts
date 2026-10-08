// ============================================================
// Lecture des saisies de l'entretien (règle, signalement). Module
// pur, testé : tout ce qui vient d'un formulaire est borné ici.
// ============================================================

import { estJour } from "../registre/temps.ts";
import type { Frequence, ModeCalcul, PreuveExigee, Qui, Regle, UniteFrequence } from "./types.ts";

const texte = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const liste = (v: unknown, max: number, maxTexte = 120) =>
  Array.isArray(v) ? [...new Set(v.map((x) => texte(x, maxTexte)).filter(Boolean))].slice(0, max) : [];
const courriel = (v: unknown) => {
  const e = texte(v, 200).toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) ? e : "";
};

export const MESSAGES_REGLE: Record<string, string> = {
  corps: "Saisie illisible",
  titre: "Le titre est obligatoire",
  cible: "Choisir au moins un équipement ou une salle",
  prochaine: "Date d'échéance invalide",
  fenetre: "La fenêtre va de 0 à 365 jours",
  procedure: "Le lien de procédure doit commencer par https://",
};

const UNITES: UniteFrequence[] = ["jour", "semaine", "mois", "an"];
const PREUVES: PreuveExigee[] = ["aucune", "photo", "rapport", "mesure"];

export function lireFrequenceSaisie(v: unknown): Frequence | null {
  if (!v || typeof v !== "object") return null;
  const f = v as Record<string, unknown>;
  if (f.type === "ponctuelle") return { type: "ponctuelle" };
  if (f.type === "saisonniere") {
    const mois = Array.isArray(f.mois)
      ? [...new Set(f.mois.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b)
      : [];
    return mois.length ? { type: "saisonniere", mois } : null;
  }
  if (f.type === "periodique") {
    const n = Math.round(Number(f.n));
    const unite = UNITES.find((u) => u === f.unite);
    if (!unite || !Number.isFinite(n) || n < 1 || n > 100) return null;
    return { type: "periodique", n, unite };
  }
  return null;
}

export function lireQuiSaisie(v: unknown): Qui | null {
  if (!v || typeof v !== "object") return null;
  const q = v as Record<string, unknown>;
  if (q.type === "personne") {
    const email = courriel(q.email);
    return email ? { type: "personne", email } : null;
  }
  if (q.type === "metier") {
    const metier = texte(q.metier, 80);
    return metier ? { type: "metier", metier } : null;
  }
  if (q.type === "soustraitant") {
    const fournisseur = texte(q.fournisseur, 120);
    return { type: "soustraitant", fournisseur, repondant: courriel(q.repondant) };
  }
  return null;
}

export type ChampsRegle = Pick<
  Regle,
  | "titre"
  | "type"
  | "consigne"
  | "procedureUrl"
  | "actifIds"
  | "salleIds"
  | "equipementLibre"
  | "frequence"
  | "prochaine"
  | "calcul"
  | "fenetreJours"
  | "qui"
  | "checklist"
  | "preuve"
  | "mesureUnite"
  | "criticite"
  | "remarque"
>;

/**
 * Une règle saisie (fenêtre « Ajouter un entretien »). Le titre et une cible
 * (équipement, salle ou équipement nommé) sont obligatoires ; sans fréquence
 * ou sans prochaine date, la règle est « à compléter » et ne crée aucune tâche.
 */
export function lireRegle(body: unknown): { regle: ChampsRegle; complete: boolean } | { erreur: string } {
  if (!body || typeof body !== "object") return { erreur: "corps" };
  const b = body as Record<string, unknown>;
  const titre = texte(b.titre, 140);
  if (!titre) return { erreur: "titre" };
  const actifIds = liste(b.actifIds, 60, 80);
  const salleIds = liste(b.salleIds, 30, 80);
  const equipementLibre = texte(b.equipementLibre, 140);
  if (!actifIds.length && !salleIds.length && !equipementLibre) return { erreur: "cible" };
  const prochaine = b.prochaine == null || b.prochaine === "" ? null : estJour(b.prochaine) ? (b.prochaine as string) : undefined;
  if (prochaine === undefined) return { erreur: "prochaine" };
  const frequence = lireFrequenceSaisie(b.frequence);
  const fen = b.fenetreJours == null || b.fenetreJours === "" ? null : Math.round(Number(b.fenetreJours));
  if (fen !== null && (!Number.isFinite(fen) || fen < 0 || fen > 365)) return { erreur: "fenetre" };
  const url = texte(b.procedureUrl, 500);
  if (url && !/^https:\/\//.test(url)) return { erreur: "procedure" };
  const regle: ChampsRegle = {
    titre,
    type: texte(b.type, 80),
    consigne: texte(b.consigne, 2000),
    procedureUrl: url,
    actifIds,
    salleIds,
    equipementLibre,
    frequence,
    prochaine,
    calcul: (b.calcul === "faite" ? "faite" : "prevue") as ModeCalcul,
    fenetreJours: fen,
    qui: lireQuiSaisie(b.qui),
    checklist: liste(b.checklist, 30, 200),
    preuve: PREUVES.find((p) => p === b.preuve) ?? "photo",
    mesureUnite: texte(b.mesureUnite, 20),
    criticite: texte(b.criticite, 60),
    remarque: texte(b.remarque, 1000),
  };
  return { regle, complete: !!frequence && !!prochaine && !!regle.qui };
}

/** Champs d'une règle changés (pour le registre) : avant → après, lisibles. */
export function changementsRegle(avant: ChampsRegle, apres: ChampsRegle): Record<string, { before: string; after: string }> {
  const champs: (keyof ChampsRegle)[] = ["titre", "type", "consigne", "frequence", "prochaine", "calcul", "fenetreJours", "qui", "preuve", "criticite", "checklist", "actifIds", "salleIds"];
  const lisible = (v: unknown): string => {
    if (v == null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (o.type === "periodique") return `tous les ${o.n} ${o.unite}`;
      if (o.type === "saisonniere") return `saison : mois ${(o.mois as number[]).join(", ")}`;
      if (o.type === "ponctuelle") return "une seule fois";
      if (o.type === "personne") return String(o.email);
      if (o.type === "metier") return String(o.metier);
      if (o.type === "soustraitant") return [o.fournisseur || "sous-traitant", o.repondant].filter(Boolean).join(", répondant ");
      return JSON.stringify(v);
    }
    return String(v);
  };
  const out: Record<string, { before: string; after: string }> = {};
  for (const c of champs) {
    const a = lisible(avant[c]);
    const b = lisible(apres[c]);
    if (a !== b) out[`regle.${c}`] = { before: a, after: b };
  }
  return out;
}

export interface SignalementSaisi {
  description: string;
  priorite: number;
  actifIds: string[];
  horsService: boolean;
  assigner: string[];
}

export function lireSignalement(champs: Record<string, unknown>): SignalementSaisi | { erreur: string } {
  const description = texte(champs.description, 1000);
  if (description.length < 3) return { erreur: "description" };
  const p = Math.round(Number(champs.priorite ?? 3));
  if (!Number.isFinite(p) || p < 0 || p > 5) return { erreur: "priorite" };
  const actifIds = typeof champs.actifIds === "string" ? champs.actifIds.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) : liste(champs.actifIds, 10, 80);
  const assigner = (typeof champs.assigner === "string" ? champs.assigner.split(",") : Array.isArray(champs.assigner) ? champs.assigner : [])
    .map(courriel)
    .filter(Boolean)
    .slice(0, 5);
  return {
    description,
    priorite: p,
    actifIds,
    horsService: champs.horsService === true || champs.horsService === "true" || champs.horsService === "1",
    assigner,
  };
}
