// ============================================================
// Reprise de la GMAO (lot 0) : lecture des valeurs de la feuille
// AppSheet et du registre GANDALF de Maxime. Module pur.
// ============================================================

import type { Frequence, PreuveExigee, Qui, Regle } from "./types.ts";

/** « Annuel », « Semestriel », « Aux 5 ans », « Annuel (Saisonnier) »… → fréquence ; null si vide ou inconnue. */
export function lireFrequence(v: string, moisSaison: number[] = []): Frequence | null {
  const s = (v || "").trim().toLowerCase();
  if (!s) return null;
  if (s.includes("saison")) return { type: "saisonniere", mois: moisSaison.length ? moisSaison : [7, 8] };
  const aux = /aux?\s+(\d+)\s+ans?/.exec(s);
  if (aux) return { type: "periodique", n: Number(aux[1]), unite: "an" };
  if (s.startsWith("quotidien")) return { type: "periodique", n: 1, unite: "jour" };
  if (s.startsWith("hebdo")) return { type: "periodique", n: 1, unite: "semaine" };
  if (s.startsWith("mensuel")) return { type: "periodique", n: 1, unite: "mois" };
  if (s.startsWith("trimestri")) return { type: "periodique", n: 3, unite: "mois" };
  if (s.startsWith("semestri")) return { type: "periodique", n: 6, unite: "mois" };
  if (s.startsWith("annuel")) return { type: "periodique", n: 1, unite: "an" };
  return null;
}

/** « 06/04/2026 » (jour/mois/année, comme la GMAO) → « 2026-04-06 » ; null si vide ou invalide. */
export function lireDateGmao(v: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((v || "").trim());
  if (!m) return null;
  const [, j, mo, a] = m;
  const iso = `${a}-${mo.padStart(2, "0")}-${j.padStart(2, "0")}`;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.getUTCDate() !== Number(j)) return null;
  return iso;
}

/** « 89 , 90 , 91 » → ["89", "90", "91"]. */
export function lireRefs(v: string): string[] {
  return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Corps de métier de la GMAO → qui fait (la personne par défaut du métier est réglée dans l'app). */
export function lireQui(corps: string, fournisseur = ""): Qui | null {
  const c = (corps || "").trim();
  if (!c) return null;
  if (c === "Sous-traitant") return { type: "soustraitant", fournisseur, repondant: "" };
  return { type: "metier", metier: c };
}

/** Preuve proposée : le rapport ou la facture pour un sous-traitant, une photo sinon. */
export function preuveProposee(qui: Qui | null): PreuveExigee {
  return qui?.type === "soustraitant" ? "rapport" : "photo";
}

/** Une règle est complète quand elle a une fréquence, une prochaine date, quelque chose à entretenir et quelqu'un. */
export function regleComplete(r: Partial<Regle>): boolean {
  const cible = (r.actifIds?.length ?? 0) > 0 || (r.salleIds?.length ?? 0) > 0 || !!r.equipementLibre;
  return !!r.titre && !!r.frequence && !!r.prochaine && cible && !!r.qui;
}

/** Fournisseur nommé dans une description (« Planifier l'inspection par Compresseur Drummond. »). */
export function fournisseurDe(texte: string): string {
  const m = /\bpar\s+([A-ZÉÈ][\p{L}'’-]+(?:\s+[A-ZÉÈ][\p{L}'’-]+)*)/u.exec(texte || "");
  return m ? m[1].trim() : "";
}
