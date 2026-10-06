// ============================================================
// Équipements orphelins (lot 0) : salle proposée pour un code de
// salle qui n'existe pas (module pur).
//
// Le Google Sheet d'origine donnait souvent le NOM de la salle au
// lieu de son code (« SALLE CHANV 1 » pour ZONE MULTI 13). Les
// propositions sont validées par une personne avant d'être appliquées.
// ============================================================

import { normaliseTolerant } from "../sensor-match-core.ts";

export type Certitude = "meme_nom" | "probable" | "a_decider";

export interface SalleRef {
  id: string;
  nomSalle: string;
}

export interface Proposition {
  salleId: string | null;
  certitude: Certitude;
}

const MOTS_VIDES = new Set(["DE", "DES", "DU", "LA", "LE", "LES", "D", "L", "ET", "A", "AU", "AUX"]);

function mots(s: string): string[] {
  return normaliseTolerant(s)
    .split(" ")
    .filter((m) => m && !MOTS_VIDES.has(m));
}

const memeEnsemble = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((x) => b.has(x));

/** Salle proposée pour un code inconnu, avec le degré de certitude. */
export function proposerSalle(code: string, salles: SalleRef[]): Proposition {
  const brut = code.trim();
  const aucune: Proposition = { salleId: null, certitude: "a_decider" };
  // Deux salles dans un seul champ : à trancher par une personne.
  if (!brut || /[,;/]/.test(brut)) return aucune;

  const n = normaliseTolerant(brut);
  const parId = salles.filter((s) => normaliseTolerant(s.id) === n);
  if (parId.length === 1) return { salleId: parId[0].id, certitude: "meme_nom" };
  const parNom = salles.filter((s) => s.nomSalle && normaliseTolerant(s.nomSalle) === n);
  if (parNom.length === 1) return { salleId: parNom[0].id, certitude: "meme_nom" };

  const m = new Set(mots(brut));
  if (m.size === 0) return aucune;

  // Mêmes mots dans un autre ordre (« SALLE CHANV FABRICATION » ↔ « Salle de fabrication Chanv »).
  const ensemble = salles.filter((s) => s.nomSalle && memeEnsemble(m, new Set(mots(s.nomSalle))));
  if (ensemble.length === 1) return { salleId: ensemble[0].id, certitude: "probable" };

  // Tous les mots du code dans le nom d'une seule salle (au moins deux mots).
  if (m.size >= 2) {
    const inclus = salles
      .filter((s) => s.nomSalle)
      .map((s) => ({ s, mm: new Set(mots(s.nomSalle)) }))
      .filter(({ mm }) => [...m].every((x) => mm.has(x)))
      .sort((a, b) => a.mm.size - b.mm.size);
    if (inclus.length === 1 || (inclus.length > 1 && inclus[0].mm.size < inclus[1].mm.size)) {
      return { salleId: inclus[0].s.id, certitude: "probable" };
    }
  }

  // Sigle : « BUREAUX AQ » → « Assurance qualité ». Codes courts seulement
  // (« BRISÉ NE PAS UTILISER » n'est pas un sigle).
  const sigles = m.size <= 2 ? [...m].filter((x) => /^[A-Z]{2,4}$/.test(x)) : [];
  for (const sigle of sigles) {
    const hits = salles.filter((s) => {
      const mm = mots(s.nomSalle || "");
      return mm.length === sigle.length && mm.map((x) => x[0]).join("") === sigle;
    });
    if (hits.length === 1) return { salleId: hits[0].id, certitude: "probable" };
  }

  return aucune;
}
