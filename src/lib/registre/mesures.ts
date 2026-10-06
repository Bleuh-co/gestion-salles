// ============================================================
// Calculs sur les relevés de température et d'humidité.
//
// Module pur : résumés par jour, écarts à la plage, capteurs
// muets, moyennes par heure. Rien n'est stocké : tout se recalcule
// sur le passé (une plage corrigée corrige les écarts).
//
// Règles (plan « Un registre par salle », 2.4) :
//   - un écart commence quand au moins SEUIL_ECART relevés de
//     suite sortent de la plage ; il finit au premier relevé revenu ;
//   - un capteur est muet quand au moins deux relevés attendus
//     manquent (silence > 2,5 intervalles).
// ============================================================

import { debutJour, finJour, jourDe } from "./temps.ts";

/** Un relevé : t en ms UTC, c en °C, h en % d'humidité relative. */
export interface Releve {
  t: number;
  c: number | null;
  h: number | null;
}

/** Intervalle de temps [du, au), en ms UTC. */
export interface Fenetre {
  du: number;
  au: number;
}

export interface Plage {
  min: number | null;
  max: number | null;
}

export type Grandeur = "c" | "h";

export const SEUIL_ECART = 2;
const SEUIL_MUET = 2.5;

// ---- Fenêtres -------------------------------------------------------------

export function couperFenetres(fenetres: Fenetre[], du: number, au: number): Fenetre[] {
  return fenetres
    .map((f) => ({ du: Math.max(f.du, du), au: Math.min(f.au, au) }))
    .filter((f) => f.au > f.du);
}

export function dureeFenetres(fenetres: Fenetre[]): number {
  return fenetres.reduce((s, f) => s + (f.au - f.du), 0);
}

export function dansFenetres(t: number, fenetres: Fenetre[]): boolean {
  return fenetres.some((f) => t >= f.du && t < f.au);
}

/** Relevés compris dans les fenêtres, triés, sans doublon d'heure. */
export function filtrerReleves(releves: Releve[], fenetres: Fenetre[]): Releve[] {
  const vus = new Set<number>();
  return releves
    .filter((r) => dansFenetres(r.t, fenetres))
    .sort((a, b) => a.t - b.t)
    .filter((r) => (vus.has(r.t) ? false : (vus.add(r.t), true)));
}

/** Union d'intervalles qui se chevauchent. */
export function unir(fenetres: Fenetre[]): Fenetre[] {
  const tri = [...fenetres].filter((f) => f.au > f.du).sort((a, b) => a.du - b.du);
  const out: Fenetre[] = [];
  for (const f of tri) {
    const der = out[out.length - 1];
    if (der && f.du <= der.au) der.au = Math.max(der.au, f.au);
    else out.push({ ...f });
  }
  return out;
}

export function attendusDans(dureeMs: number, intervalleMs: number): number {
  return intervalleMs > 0 ? Math.round(dureeMs / intervalleMs) : 0;
}

// ---- Plage et écarts ------------------------------------------------------

export function plageDefinie(p: Plage | null | undefined): p is Plage {
  return !!p && (p.min != null || p.max != null);
}

export function horsPlage(v: number | null, p: Plage | null | undefined): "haut" | "bas" | null {
  if (v == null || !plageDefinie(p)) return null;
  if (p.min != null && v < p.min) return "bas";
  if (p.max != null && v > p.max) return "haut";
  return null;
}

export interface Ecart {
  grandeur: Grandeur;
  sens: "haut" | "bas";
  debut: number;
  fin: number;
  /** Valeur la plus éloignée de la plage pendant l'écart. */
  extreme: number;
  /** Relevés hors plage. */
  n: number;
  /** Aucun relevé n'est revenu dans la plage avant la fin des données. */
  enCours: boolean;
}

/**
 * Écarts d'une série (un capteur, une fenêtre) à la plage : au moins
 * `seuil` relevés de suite hors plage, du même côté.
 */
export function calculerEcarts(
  releves: Releve[],
  grandeur: Grandeur,
  plage: Plage | null | undefined,
  intervalleMs: number,
  seuil = SEUIL_ECART
): Ecart[] {
  if (!plageDefinie(plage)) return [];
  const out: Ecart[] = [];
  let run: Releve[] = [];
  let sens: "haut" | "bas" | null = null;

  const finir = (retour: number | null) => {
    if (run.length >= seuil && sens) {
      const vals = run.map((r) => r[grandeur] as number);
      out.push({
        grandeur,
        sens,
        debut: run[0].t,
        fin: retour ?? run[run.length - 1].t + intervalleMs,
        extreme: sens === "haut" ? Math.max(...vals) : Math.min(...vals),
        n: run.length,
        enCours: retour == null,
      });
    }
  };

  for (const r of [...releves].sort((a, b) => a.t - b.t)) {
    const v = r[grandeur];
    if (v == null) continue;
    const s = horsPlage(v, plage);
    if (s && (run.length === 0 || s === sens)) {
      run.push(r);
      sens = s;
      continue;
    }
    finir(r.t);
    run = s ? [r] : [];
    sens = s;
  }
  finir(null);
  return out;
}

// ---- Capteur muet ---------------------------------------------------------

export interface Muet {
  debut: number;
  fin: number;
  /** Relevés attendus et non reçus pendant le silence. */
  manquants: number;
  enCours: boolean;
}

/**
 * Silences d'un capteur dans une fenêtre : au moins deux relevés attendus
 * manquants. `maintenant` borne la fin de la fenêtre (pas de silence futur).
 */
export function calculerMuets(
  releves: Releve[],
  fenetre: Fenetre,
  intervalleMs: number,
  maintenant: number
): Muet[] {
  if (!(intervalleMs > 0)) return [];
  const fin = Math.min(fenetre.au, maintenant);
  if (fin <= fenetre.du) return [];
  const heures = releves
    .map((r) => r.t)
    .filter((t) => t >= fenetre.du && t < fin)
    .sort((a, b) => a - b);
  const out: Muet[] = [];
  const seuil = SEUIL_MUET * intervalleMs;

  let prec = fenetre.du;
  let precEstReleve = false;
  for (const t of heures) {
    if (t - prec > seuil) {
      const n = (t - prec) / intervalleMs;
      out.push({
        debut: prec,
        fin: t,
        manquants: precEstReleve ? Math.round(n) - 1 : Math.floor(n),
        enCours: false,
      });
    }
    prec = t;
    precEstReleve = true;
  }
  if (fin - prec > seuil) {
    out.push({
      debut: prec,
      fin,
      manquants: Math.floor((fin - prec) / intervalleMs),
      enCours: fin >= maintenant,
    });
  }
  return out;
}

// ---- Agrégats -------------------------------------------------------------

export interface Extreme {
  v: number;
  t: number;
}

export interface Agregat {
  n: number;
  min: Extreme | null;
  max: Extreme | null;
  moy: number | null;
}

export function agreger(releves: Releve[], grandeur: Grandeur): Agregat {
  let n = 0;
  let somme = 0;
  let min: Extreme | null = null;
  let max: Extreme | null = null;
  for (const r of releves) {
    const v = r[grandeur];
    if (v == null) continue;
    n++;
    somme += v;
    if (!min || v < min.v) min = { v, t: r.t };
    if (!max || v > max.v) max = { v, t: r.t };
  }
  return { n, min, max, moy: n ? somme / n : null };
}

export interface Point {
  t: number;
  v: number;
}

/** Moyenne par pas fixe (ex. 3 600 000 = par heure ; les fuseaux d'ici sont à l'heure pile). */
export function moyenneParPas(releves: Releve[], grandeur: Grandeur, pasMs: number): Point[] {
  const seaux = new Map<number, { s: number; n: number }>();
  for (const r of releves) {
    const v = r[grandeur];
    if (v == null) continue;
    const k = Math.floor(r.t / pasMs) * pasMs;
    const x = seaux.get(k) ?? { s: 0, n: 0 };
    x.s += v;
    x.n++;
    seaux.set(k, x);
  }
  return [...seaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, x]) => ({ t, v: x.s / x.n }));
}

export interface PointJour {
  jour: string;
  t: number;
  min: number;
  max: number;
  moy: number;
}

/** Minimum, maximum et moyenne par jour de Montréal. */
export function parJour(releves: Releve[], grandeur: Grandeur): PointJour[] {
  const jours = new Map<string, Releve[]>();
  for (const r of releves) {
    if (r[grandeur] == null) continue;
    const j = jourDe(r.t);
    const l = jours.get(j);
    if (l) l.push(r);
    else jours.set(j, [r]);
  }
  return [...jours.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([jour, rs]) => {
      const a = agreger(rs, grandeur);
      return { jour, t: debutJour(jour), min: a.min!.v, max: a.max!.v, moy: a.moy! };
    });
}

// ---- Série d'un capteur dans une salle --------------------------------------

/** Les relevés d'un capteur pendant qu'il était dans la salle. */
export interface SerieCapteur {
  sensorId: string;
  nom: string;
  intervalleMs: number;
  fenetres: Fenetre[];
  releves: Releve[];
}

export interface ResumeJour {
  jour: string;
  recus: number;
  attendus: number;
  cMin: number | null;
  cMax: number | null;
  cMoy: number | null;
  hMin: number | null;
  hMax: number | null;
  hMoy: number | null;
  minutesHorsPlage: number;
  /** Jour en cours, ou couvert en partie seulement par les capteurs. */
  partiel: boolean;
}

/** Résumé par jour de Montréal pour une salle (tous ses capteurs). */
export function resumerParJour(
  series: SerieCapteur[],
  jours: string[],
  ecarts: Ecart[],
  maintenant: number
): ResumeJour[] {
  const horsPlage = unir(ecarts.map((e) => ({ du: e.debut, au: e.fin })));
  return jours.map((jour) => {
    const d = debutJour(jour);
    const f = Math.min(finJour(jour), maintenant);
    let attendus = 0;
    let couvert = 0;
    const tous: Releve[] = [];
    for (const s of series) {
      const fen = couperFenetres(s.fenetres, d, f);
      const duree = dureeFenetres(fen);
      couvert = Math.max(couvert, duree);
      attendus += attendusDans(duree, s.intervalleMs);
      tous.push(...filtrerReleves(s.releves, fen));
    }
    const c = agreger(tous, "c");
    const h = agreger(tous, "h");
    const minutes = dureeFenetres(couperFenetres(horsPlage, d, f)) / 60_000;
    return {
      jour,
      recus: tous.length,
      attendus,
      cMin: c.min?.v ?? null,
      cMax: c.max?.v ?? null,
      cMoy: c.moy,
      hMin: h.min?.v ?? null,
      hMax: h.max?.v ?? null,
      hMoy: h.moy,
      minutesHorsPlage: Math.round(minutes),
      partiel: f < finJour(jour) || couvert < f - d,
    };
  });
}

export interface StatsPeriode {
  recus: number;
  attendus: number;
  c: Agregat;
  h: Agregat;
  /** Début des mesures dans la salle s'il est postérieur au début de la période. */
  depuis: number | null;
  ecarts: (Ecart & { sensorId: string; nom: string })[];
  muets: (Muet & { sensorId: string; nom: string })[];
  /** Plus long silence entre deux relevés (ms). */
  plusLongTrou: number;
}

/** Chiffres d'une période pour une salle : mesures, écarts, silences. */
export function statsPeriode(
  series: SerieCapteur[],
  du: number,
  au: number,
  plageC: Plage | null,
  plageH: Plage | null,
  maintenant: number,
  seuil = SEUIL_ECART
): StatsPeriode {
  const fin = Math.min(au, maintenant);
  const tous: Releve[] = [];
  const ecarts: StatsPeriode["ecarts"] = [];
  const muets: StatsPeriode["muets"] = [];
  let attendus = 0;
  let premier: number | null = null;
  let plusLongTrou = 0;
  for (const s of series) {
    const fen = couperFenetres(s.fenetres, du, fin);
    if (fen.length && (premier == null || fen[0].du < premier)) premier = fen[0].du;
    attendus += attendusDans(dureeFenetres(fen), s.intervalleMs);
    for (const w of fen) {
      const rs = filtrerReleves(s.releves, [w]);
      tous.push(...rs);
      const qui = { sensorId: s.sensorId, nom: s.nom };
      for (const e of calculerEcarts(rs, "c", plageC, s.intervalleMs, seuil)) ecarts.push({ ...e, ...qui });
      for (const e of calculerEcarts(rs, "h", plageH, s.intervalleMs, seuil)) ecarts.push({ ...e, ...qui });
      for (const m of calculerMuets(rs, w, s.intervalleMs, maintenant)) {
        muets.push({ ...m, sensorId: s.sensorId, nom: s.nom });
      }
      for (let i = 1; i < rs.length; i++) {
        plusLongTrou = Math.max(plusLongTrou, rs[i].t - rs[i - 1].t);
      }
    }
  }
  ecarts.sort((a, b) => a.debut - b.debut);
  muets.sort((a, b) => a.debut - b.debut);
  return {
    recus: tous.length,
    attendus,
    c: agreger(tous, "c"),
    h: agreger(tous, "h"),
    depuis: premier != null && premier > du ? premier : null,
    ecarts,
    muets,
    plusLongTrou,
  };
}
