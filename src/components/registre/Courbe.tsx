"use client";

import { useMemo, useRef, useState } from "react";
import { CourbeSvg, echelle, type SerieCourbe } from "./CourbeSvg";
import { FUSEAU } from "@/lib/registre/temps";

// ============================================================
// Courbe interactive : la ligne verticale suit le pointeur (ou les
// flèches du clavier) et se cale sur le relevé le plus proche ; la
// bulle donne la valeur de chaque série à cet instant. Les mêmes
// valeurs restent lisibles sans survol (tableau par jour, légende).
// ============================================================

interface Props {
  series: SerieCourbe[];
  du: number;
  au: number;
  plage?: { min: number | null; max: number | null } | null;
  unite: string;
  locale: string;
  titre: string;
  hauteur?: number;
  largeur?: number;
  /** Pas « jour » : la bulle donne la date seule. */
  parJour?: boolean;
}

function proche<T extends { t: number }>(pts: T[], t: number): T | null {
  if (!pts.length) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (pts[m].t <= t) lo = m;
    else hi = m;
  }
  return Math.abs(pts[lo].t - t) <= Math.abs(pts[hi].t - t) ? pts[lo] : pts[hi];
}

export function Courbe(props: Props) {
  const { series, unite, locale, titre, parJour = false } = props;
  const largeur = props.largeur ?? 720;
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<number | null>(null);
  const e = echelle(props);

  const temps = useMemo(() => {
    const s = new Set<number>();
    for (const x of series) for (const p of x.points) s.add(p.t);
    return [...s].sort((a, b) => a - b);
  }, [series]);
  const pas = useMemo(() => {
    const d = temps.slice(1).map((x, i) => x - temps[i]).sort((a, b) => a - b);
    return d[Math.floor(d.length / 2)] ?? 3600_000;
  }, [temps]);

  if (!e) return <CourbeSvg {...props} />;

  const caler = (brut: number) => {
    if (!temps.length) return setT(null);
    let lo = 0;
    let hi = temps.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (temps[m] <= brut) lo = m;
      else hi = m;
    }
    setT(Math.abs(temps[lo] - brut) <= Math.abs(temps[hi] - brut) ? temps[lo] : temps[hi]);
  };
  const xPct = t != null ? (e.x(t) / largeur) * 100 : 0;
  const fmtV = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const fmtT = new Intl.DateTimeFormat(locale, {
    timeZone: FUSEAU,
    day: "numeric",
    month: "short",
    ...(parJour ? {} : { hour: "2-digit", minute: "2-digit" }),
  });

  return (
    <div
      ref={ref}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-chanv-beige/60 rounded-lg"
      role="figure"
      aria-label={titre}
      tabIndex={0}
      onPointerMove={(ev) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        caler(e.t(((ev.clientX - r.left) / r.width) * largeur));
      }}
      onPointerLeave={() => setT(null)}
      onFocus={() => setT((v) => v ?? temps[temps.length - 1] ?? null)}
      onBlur={() => setT(null)}
      onKeyDown={(ev) => {
        if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
        ev.preventDefault();
        const i = t == null ? temps.length - 1 : temps.indexOf(t);
        const j = Math.max(0, Math.min(temps.length - 1, i + (ev.key === "ArrowLeft" ? -1 : 1)));
        setT(temps[j] ?? null);
      }}
    >
      <CourbeSvg {...props} />
      {t != null && (
        <>
          <div
            className="absolute w-px bg-slate-400/70 pointer-events-none"
            style={{ left: `${xPct}%`, top: `${(e.h / (props.hauteur ?? 180)) * 100}%`, bottom: `${(e.b / (props.hauteur ?? 180)) * 100}%` }}
          />
          <div
            className="absolute z-10 pointer-events-none rounded-lg border border-chanv-fibre bg-white shadow-chanv-soft px-2.5 py-1.5 text-xs min-w-[8rem]"
            style={xPct < 60 ? { left: `calc(${xPct}% + 10px)`, top: 4 } : { right: `calc(${100 - xPct}% + 10px)`, top: 4 }}
          >
            <div className="text-[10px] text-slate-400 mb-0.5">{fmtT.format(new Date(t))}</div>
            {series.map((s) => {
              const p = proche(s.points, t);
              const ok = p && Math.abs(p.t - t) <= pas * 1.5;
              const b = ok && s.bande ? proche(s.bande, t) : null;
              return (
                <div key={s.nom} className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="inline-block w-3 h-0.5 rounded" style={{ background: s.couleur }} />
                  <strong className="text-chanv-terre tabular-nums">
                    {ok ? `${fmtV.format(p!.v)} ${unite}` : "—"}
                  </strong>
                  {b && (
                    <span className="text-slate-400 tabular-nums">
                      ({fmtV.format(b.min)}–{fmtV.format(b.max)})
                    </span>
                  )}
                  {series.length > 1 && <span className="text-slate-500 truncate max-w-[10rem]">{s.nom}</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
