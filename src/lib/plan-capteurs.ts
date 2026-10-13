// ============================================================
// Plan de GANDALF (hub, page Plan) : chaque capteur y est un point posé
// dans plans/{planId}.sensor_positions. Le repère de chaque salle
// (room_positions, sur son nom dans l'image) est tenu ici, dans le Plan
// de Gestion des Salles. Quand un capteur change de salle, son point
// suit : il va sous le repère de la nouvelle salle, ou quitte le plan si
// cette salle n'est placée sur aucun plan (un point dans l'ancienne
// salle montrerait des mesures qui n'y sont plus).
// Module pur : la lecture et l'écriture sont dans repo/plan-capteurs.ts.
// ============================================================

export interface Point {
  x: number;
  y: number;
}

export interface PointCapteur extends Point {
  label: string | null;
}

export interface PlanCapteurs {
  id: string;
  nom: string;
  ordre: number;
  /** room_positions : repère de chaque salle placée. */
  salles: Record<string, Point>;
  /** sensor_positions : point de chaque capteur affiché. */
  capteurs: Record<string, PointCapteur>;
}

export interface Placement {
  /** Où poser le capteur ; null = sur aucun plan. */
  cible: { planId: string; point: PointCapteur } | null;
  /** Plans d'où retirer son point. */
  retirerDe: string[];
}

/** Ce que le plan a fait, renvoyé à l'écran qui a changé la salle. */
export type SuiviPlan =
  | { action: "rien" }
  | { action: "place"; planId: string; planNom: string; salleId: string }
  | { action: "retire"; salleId: string | null }
  | { action: "erreur"; erreur: string };

/** Premier point juste sous le nom de la salle, les suivants l'un sous l'autre. */
export const DECALAGE_Y = 0.015;
export const PAS_Y = 0.032;
const PROCHE_X = 0.012;
const PROCHE_Y = 0.012;
const RANGS = 6;

const arrondi = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 1e4) / 1e4;

/** Valeurs lues dans Firestore : seulement les points aux coordonnées valides. */
export function lirePoints(brut: unknown): Record<string, PointCapteur> {
  const out: Record<string, PointCapteur> = {};
  if (!brut || typeof brut !== "object") return out;
  for (const [id, v] of Object.entries(brut as Record<string, unknown>)) {
    const p = (v ?? {}) as { x?: unknown; y?: unknown; label?: unknown };
    const x = Number(p.x);
    const y = Number(p.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out[id] = { x, y, label: typeof p.label === "string" ? p.label : null };
  }
  return out;
}

/**
 * Plan où montrer une salle. Une salle peut avoir un repère sur plusieurs
 * plans (des salles du BAT1 sont restées rangées au bord du plan Bleuh-1) :
 * on prend le plan qui place le plus de salles du même bâtiment, puis
 * celui où le capteur est déjà, puis l'ordre des plans.
 */
export function choisirPlan(
  plans: PlanCapteurs[],
  salleId: string,
  batimentDe: (salleId: string) => string | undefined,
  planActuel: string | null
): PlanCapteurs | null {
  const candidats = plans.filter((p) => p.salles[salleId]);
  if (!candidats.length) return null;
  const bat = batimentDe(salleId);
  const memeBatiment = (p: PlanCapteurs) => (bat ? Object.keys(p.salles).filter((id) => batimentDe(id) === bat).length : 0);
  return [...candidats].sort(
    (a, b) =>
      memeBatiment(b) - memeBatiment(a) ||
      Number(b.id === planActuel) - Number(a.id === planActuel) ||
      a.ordre - b.ordre
  )[0];
}

/** Premier rang libre sous le repère (au-dessus s'il touche le bas de l'image). */
export function pointLibre(plan: PlanCapteurs, repere: Point, sensorId: string): Point {
  const autres = Object.entries(plan.capteurs)
    .filter(([id]) => id !== sensorId)
    .map(([, p]) => p);
  const rang = (k: number): Point => {
    const dessous = repere.y + DECALAGE_Y + k * PAS_Y;
    return { x: arrondi(repere.x), y: arrondi(dessous <= 0.98 ? dessous : repere.y - DECALAGE_Y - k * PAS_Y) };
  };
  for (let k = 0; k < RANGS; k++) {
    const c = rang(k);
    if (!autres.some((p) => Math.abs(p.x - c.x) < PROCHE_X && Math.abs(p.y - c.y) < PROCHE_Y)) return c;
  }
  return rang(0);
}

/** Où va le point d'un capteur qui arrive dans `salleId` (null = retiré). */
export function placerCapteur(
  plans: PlanCapteurs[],
  sensorId: string,
  salleId: string | null,
  batimentDe: (salleId: string) => string | undefined
): Placement {
  const ordonnes = [...plans].sort((a, b) => a.ordre - b.ordre);
  const avec = ordonnes.filter((p) => p.capteurs[sensorId]);
  const plan = salleId ? choisirPlan(ordonnes, salleId, batimentDe, avec[0]?.id ?? null) : null;
  if (!plan || !salleId) return { cible: null, retirerDe: avec.map((p) => p.id) };
  const label = avec.map((p) => p.capteurs[sensorId].label).find((l) => l) ?? null;
  return {
    cible: { planId: plan.id, point: { ...pointLibre(plan, plan.salles[salleId], sensorId), label } },
    retirerDe: avec.filter((p) => p.id !== plan.id).map((p) => p.id),
  };
}
