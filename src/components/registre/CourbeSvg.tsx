// ============================================================
// Courbe en SVG, dessinée par l'app (sans bibliothèque de
// graphiques, comme le demandait le cahier des charges d'origine).
// Sans état ni hook : sert à l'écran (onglet Capteurs, téléphone)
// comme à la version imprimable rendue côté serveur.
// ============================================================

import { FUSEAU } from "@/lib/registre/temps";

export interface SerieCourbe {
  nom: string;
  couleur: string;
  points: { t: number; v: number }[];
  /** Bande minimum–maximum (pas « jour »). */
  bande?: { t: number; min: number; max: number }[];
  /** Opacité de la bande (0,15 par défaut). */
  opaciteBande?: number;
  epaisseur?: number;
}

interface Props {
  series: SerieCourbe[];
  du: number;
  au: number;
  plage?: { min: number | null; max: number | null } | null;
  unite: string;
  locale: string;
  hauteur?: number;
  largeur?: number;
  /** Petite courbe sans axes (résumé sur téléphone). */
  mini?: boolean;
  titre?: string;
}

const G = 40; // marge gauche (graduations)
const B = 22; // marge basse (dates)
const H = 8; // marge haute
const D = 10; // marge droite

function graduations(min: number, max: number, n = 4): number[] {
  const brut = (max - min) / n || 1;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((x) => x * p).find((x) => x >= brut) ?? brut;
  const out: number[] = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max + 1e-9; v += pas) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/** Coupe la ligne là où les données manquent (plus de 3 pas sans point). */
function chemins(pts: { x: number; y: number; t: number }[], trou: number): string {
  let d = "";
  pts.forEach((p, i) => {
    const saut = i === 0 || p.t - pts[i - 1].t > trou;
    d += `${saut ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  });
  return d;
}

export interface Echelle {
  x: (t: number) => number;
  y: (v: number) => number;
  /** Inverse de x : instant sous une abscisse du SVG. */
  t: (x: number) => number;
  g: number;
  d: number;
  h: number;
  b: number;
  vmin: number;
  vmax: number;
}

/** Échelles d'une courbe (partagées avec la couche de survol). */
export function echelle(props: Pick<Props, "series" | "du" | "au" | "plage" | "hauteur" | "largeur" | "mini">): Echelle | null {
  const { series, du, au, plage, hauteur = 180, largeur = 720, mini = false } = props;
  const g = mini ? 2 : G;
  const b = mini ? 2 : B;
  const h = mini ? 2 : H;
  const d = mini ? 2 : D;
  const valeurs = series.flatMap((s) => [...s.points.map((p) => p.v), ...(s.bande ?? []).flatMap((x) => [x.min, x.max])]);
  if (!valeurs.length) return null;
  let vmin = Math.min(...valeurs);
  let vmax = Math.max(...valeurs);
  if (plage && !mini) {
    if (plage.min != null) vmin = Math.min(vmin, plage.min);
    if (plage.max != null) vmax = Math.max(vmax, plage.max);
  }
  const marge = (vmax - vmin) * 0.08 || 1;
  vmin -= marge;
  vmax += marge;
  const fin = Math.max(au, du + 1);
  const larg = largeur - g - d;
  return {
    x: (t) => g + ((t - du) / (fin - du)) * larg,
    y: (v) => h + (1 - (v - vmin) / (vmax - vmin)) * (hauteur - h - b),
    t: (x) => du + ((x - g) / larg) * (fin - du),
    g,
    d,
    h,
    b,
    vmin,
    vmax,
  };
}

export function CourbeSvg({
  series,
  du,
  au,
  plage,
  unite,
  locale,
  hauteur = 180,
  largeur = 720,
  mini = false,
  titre,
}: Props) {
  const e = echelle({ series, du, au, plage, hauteur, largeur, mini });
  if (!e) {
    return (
      <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full" role="img" aria-label={titre}>
        <text x={largeur / 2} y={hauteur / 2} textAnchor="middle" className="fill-slate-400" fontSize="12">
          —
        </text>
      </svg>
    );
  }
  const { x, y, g, h, b, vmin, vmax } = e;
  const dr = e.d;
  const fin = Math.max(au, du + 1);
  const dureeMs = fin - du;

  // Graduations de temps : heures sur 1–2 jours, jours ensuite.
  const tics: number[] = [];
  const jour = 86_400_000;
  const pasT = dureeMs <= 2 * jour ? 6 * 3600_000 : dureeMs <= 10 * jour ? jour : dureeMs <= 45 * jour ? 7 * jour : 30 * jour;
  const fmtT = new Intl.DateTimeFormat(locale, {
    timeZone: FUSEAU,
    ...(pasT < jour ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" }),
  });
  for (let t = Math.ceil(du / pasT) * pasT; t <= fin; t += pasT) tics.push(t);
  const fmtV = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const yPlageHaut = plage?.max != null ? y(Math.min(plage.max, vmax)) : h;
  const yPlageBas = plage?.min != null ? y(Math.max(plage.min, vmin)) : hauteur - b;
  const trouMax = (s: SerieCourbe) => {
    const ecarts = s.points.slice(1).map((p, i) => p.t - s.points[i].t).sort((a, c) => a - c);
    const med = ecarts[Math.floor(ecarts.length / 2)] ?? 3600_000;
    return Math.max(med * 3, 3 * 3600_000);
  };

  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full h-auto" role="img" aria-label={titre}>
      {titre && <title>{titre}</title>}
      {plage && (plage.min != null || plage.max != null) && (
        <rect
          x={g}
          y={Math.min(yPlageHaut, yPlageBas)}
          width={largeur - g - dr}
          height={Math.abs(yPlageBas - yPlageHaut)}
          style={{ fill: "var(--plage)" }}
          fillOpacity={0.1}
        />
      )}
      {!mini &&
        graduations(vmin, vmax).map((v) => (
          <g key={`y${v}`}>
            <line x1={g} x2={largeur - dr} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={g - 6} y={y(v) + 4} textAnchor="end" fontSize="10" className="fill-slate-400">
              {fmtV.format(v)}
            </text>
          </g>
        ))}
      {!mini &&
        tics.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={h} y2={hauteur - b} stroke="currentColor" strokeOpacity={0.06} />
            <text x={x(t)} y={hauteur - 6} textAnchor="middle" fontSize="10" className="fill-slate-400">
              {fmtT.format(new Date(t))}
            </text>
          </g>
        ))}
      {plage &&
        [plage.min, plage.max]
          .filter((v): v is number => v != null && v >= vmin && v <= vmax)
          .map((v) => (
            <line key={`p${v}`} x1={g} x2={largeur - dr} y1={y(v)} y2={y(v)} style={{ stroke: "var(--plage)" }} strokeDasharray="4 3" strokeOpacity={0.8} />
          ))}
      {series.map((s) =>
        s.bande?.length ? (
          <path
            key={`b${s.nom}`}
            d={`${s.bande.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.max).toFixed(1)}`).join("")}${[...s.bande]
              .reverse()
              .map((p) => `L${x(p.t).toFixed(1)} ${y(p.min).toFixed(1)}`)
              .join("")}Z`}
            style={{ fill: s.couleur }}
            fillOpacity={s.opaciteBande ?? 0.15}
          />
        ) : null
      )}
      {series.map((s) => (
        <path
          key={s.nom}
          d={chemins(s.points.map((p) => ({ x: x(p.t), y: y(p.v), t: p.t })), trouMax(s))}
          fill="none"
          style={{ stroke: s.couleur }}
          strokeWidth={s.epaisseur ?? 2}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <title>{`${s.nom} (${unite})`}</title>
        </path>
      ))}
    </svg>
  );
}

/**
 * Couleurs des capteurs (un trait par capteur, V3) : les 8 teintes de la
 * palette catégorielle validée (daltonisme, clair et sombre — variables
 * --serie-1 à 8 de globals.css), dans un ordre fixe. Au-delà de 8 capteurs,
 * les suivants passent en gris « autres » : jamais de 9e teinte.
 */
export function couleurCapteur(rang: number): string {
  return rang < 8 ? `var(--serie-${rang + 1})` : "var(--serie-autre)";
}

/** Une seule série : température en rouge, humidité en bleu (comme les cartes de capteur). */
export const COULEUR_TEMP = "var(--serie-8)";
export const COULEUR_HUM = "var(--serie-1)";
