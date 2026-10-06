// ============================================================
// Heures de Montréal, sans bibliothèque.
//
// Le serveur et les API (TempStick, Firestore) sont en UTC ; le
// registre raisonne en jours et en heures de Montréal. Un « jour »
// AAAA-MM-JJ couvre [0 h, 24 h) heure de Montréal (23 h ou 25 h
// les jours de changement d'heure).
//
// Module pur (aucun import) : utilisable côté serveur, côté client
// et dans les tests (node --test).
// ============================================================

export const FUSEAU = "America/Montreal";

/** Date du registre ouvert par la migration du Google Sheet (6 juillet 2026). */
export const OUVERTURE_DONNEES = "2026-07-06";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface Parties {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

function parties(ms: number): Parties {
  const p: Record<string, string> = {};
  for (const x of fmt.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Décalage de Montréal par rapport à UTC à cet instant, en ms (−4 h ou −5 h). */
export function decalage(ms: number): number {
  const p = parties(ms);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
}

/** Jour de Montréal (AAAA-MM-JJ) d'un instant. */
export function jourDe(ms: number): string {
  const p = parties(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Heure de Montréal (HH:MM) d'un instant. */
export function heureDe(ms: number): string {
  const p = parties(ms);
  return `${pad(p.h)}:${pad(p.mi)}`;
}

export function estJour(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** Instant UTC (ms) de 0 h, heure de Montréal, du jour donné. */
export function debutJour(jour: string): number {
  const [y, m, d] = jour.split("-").map(Number);
  const naif = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Deux passes : le décalage à minuit peut différer de celui de l'instant naïf.
  const t = naif - decalage(naif);
  return naif - decalage(t);
}

/** Instant UTC (ms) de la fin du jour (= 0 h du lendemain). */
export function finJour(jour: string): number {
  return debutJour(ajouterJours(jour, 1));
}

/** Arithmétique de calendrier : jour + n jours. */
export function ajouterJours(jour: string, n: number): string {
  const [y, m, d] = jour.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

/** Jours de du à au inclus (au ≥ du), au plus `max` jours. */
export function joursEntre(du: string, au: string, max = 800): string[] {
  const out: string[] = [];
  for (let j = du; j <= au && out.length < max; j = ajouterJours(j, 1)) out.push(j);
  return out;
}

/** Heure TempStick ("2026-10-06 16:55:12Z", "2026-05-26 19:03:31", ISO…) → ms UTC. */
export function lireHeureUtc(s: unknown): number | null {
  if (typeof s !== "string" || !s.trim()) return null;
  let x = s.trim().replace(" ", "T");
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(x)) x += "Z";
  const t = Date.parse(x);
  return Number.isNaN(t) ? null : t;
}

/** Instant UTC (ms) d'une heure de Montréal ("AAAA-MM-JJ", "HH:MM"). */
export function instantMontreal(jour: string, hhmm: string): number {
  const [h, mi] = hhmm.split(":").map(Number);
  const debut = debutJour(jour);
  const t = debut + (h * 60 + mi) * 60_000;
  return t + (decalage(debut) - decalage(t));
}

/** Midi (heure de Montréal) d'un jour : instant retenu pour un geste daté au jour. */
export function midiDe(jour: string): number {
  const debut = debutJour(jour);
  const t = debut + 12 * 3600_000;
  // Jour de changement d'heure : midi n'est pas à 12 h de minuit.
  return t + (decalage(debut) - decalage(t));
}
