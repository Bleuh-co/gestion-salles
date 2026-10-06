// ============================================================
// Rattachement daté capteur → salle (module pur).
//
// Un capteur se déplace et son passé le suit : TempStick range les
// relevés sous le capteur, pas sous la salle. Le registre garde donc
// des périodes « capteur, salle, du, au ». Les relevés d'une salle
// sont ceux de ses capteurs PENDANT qu'ils y étaient.
// ============================================================

import type { Fenetre, Releve } from "./mesures.ts";

export type SourceRattachement = "manuel" | "nom" | "reprise";

export interface Periode {
  id: string;
  sensorId: string;
  sensorName: string;
  /** null = capteur retiré ou dans une salle inconnue. */
  salleId: string | null;
  du: number;
  /** null = période en cours. */
  au: number | null;
  /** Date de pose validée par une personne (lot 0). */
  confirme: boolean;
  source: SourceRattachement;
  par: string;
  parNom: string;
  inscritA: number;
  note: string;
}

/** Fenêtres de présence de chaque capteur dans la salle, coupées à [du, au). */
export function fenetresDeSalle(
  periodes: Periode[],
  salleId: string,
  du: number,
  au: number
): Map<string, Fenetre[]> {
  const out = new Map<string, Fenetre[]>();
  for (const p of periodes) {
    if (p.salleId !== salleId) continue;
    const f = { du: Math.max(p.du, du), au: Math.min(p.au ?? Infinity, au) };
    if (f.au <= f.du) continue;
    const l = out.get(p.sensorId);
    if (l) l.push(f);
    else out.set(p.sensorId, [f]);
  }
  for (const l of out.values()) l.sort((a, b) => a.du - b.du);
  return out;
}

export function periodesDuCapteur(periodes: Periode[], sensorId: string): Periode[] {
  return periodes.filter((p) => p.sensorId === sensorId).sort((a, b) => a.du - b.du);
}

/** Période en cours d'un capteur (la plus récente si plusieurs). */
export function periodeEnCours(periodes: Periode[], sensorId: string): Periode | null {
  const l = periodesDuCapteur(periodes, sensorId).filter((p) => p.au == null);
  return l.length ? l[l.length - 1] : null;
}

/** Salle d'un capteur à un instant donné. */
export function salleA(periodes: Periode[], sensorId: string, t: number): string | null {
  const p = periodes.find((x) => x.sensorId === sensorId && x.du <= t && t < (x.au ?? Infinity));
  return p ? p.salleId : null;
}

/** Salles qui ont (ou ont eu) un capteur. */
export function sallesAvecCapteur(periodes: Periode[]): Set<string> {
  return new Set(periodes.map((p) => p.salleId).filter((s): s is string => !!s));
}

// ---- Date de pose proposée d'après les mesures ------------------------------

function mediane(vals: number[]): number {
  const v = [...vals].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function quantile(tri: number[], q: number): number {
  return tri[Math.min(tri.length - 1, Math.max(0, Math.round(q * (tri.length - 1))))];
}

export interface OptionsPose {
  /** Saut de la médiane d'un jour à l'autre qui signale un déplacement (°C). */
  saut?: number;
  /** Marge autour des valeurs du palier (°C). */
  marge?: number;
  /** Durée pendant laquelle les relevés doivent rester dans le palier (ms). */
  tenue?: number;
}

/**
 * Début du dernier palier stable de température : le capteur a
 * probablement été posé là. Un déplacement se voit comme un saut de la
 * médiane journalière (ex. congélateur à −19,8 °C puis chambre froide
 * entre 2 et 8 °C). Une dérive lente (saison) n'en est pas un.
 * Le palier commence au premier relevé à partir duquel les mesures
 * restent dans les valeurs des jours suivants : la mise en température
 * du capteur (−17 → 2 °C en deux heures) n'est pas comptée.
 * Retourne null si aucun saut n'est visible : la date de création du
 * capteur reste alors la meilleure proposition.
 */
export function proposerDatePose(
  releves: Releve[],
  jourDe: (t: number) => string,
  { saut = 6, marge = 0.5, tenue = 2 * 3600_000 }: OptionsPose = {}
): number | null {
  const tri = releves.filter((r) => r.c != null).sort((a, b) => a.t - b.t);
  const parJour = new Map<string, Releve[]>();
  for (const r of tri) {
    const j = jourDe(r.t);
    const l = parJour.get(j);
    if (l) l.push(r);
    else parJour.set(j, [r]);
  }
  const jours = [...parJour.entries()]
    .filter(([, rs]) => rs.length >= 3)
    .map(([jour, rs]) => ({ jour, rs, med: mediane(rs.map((r) => r.c as number)) }));

  for (let i = jours.length - 1; i >= 1; i--) {
    if (Math.abs(jours[i].med - jours[i - 1].med) <= saut) continue;
    // Valeurs du palier : les jours qui suivent la bascule (ou la fin du jour même).
    const apres = jours.slice(i + 1, i + 4).flatMap((j) => j.rs);
    const ref = (apres.length ? apres : jours[i].rs.slice(-Math.ceil(jours[i].rs.length / 4)))
      .map((r) => r.c as number)
      .sort((a, b) => a - b);
    const bas = quantile(ref, 0.02) - marge;
    const haut = quantile(ref, 0.98) + marge;
    const dedans = (r: Releve) => (r.c as number) >= bas && (r.c as number) <= haut;

    const zone = [...jours[i - 1].rs, ...jours[i].rs];
    const pas = mediane(zone.slice(1).map((r, k) => r.t - zone[k].t)) || 3600_000;
    const n = Math.max(3, Math.round(tenue / pas));
    for (let k = 0; k < zone.length; k++) {
      const suite = zone.slice(k, k + n);
      if (suite.length === n && suite.every(dedans)) return zone[k].t;
    }
    return jours[i].rs[0].t;
  }
  return null;
}
