"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Hammer, NotebookPen } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { dateCourte, decrireLigne, heure, nombre, type Formats } from "@/lib/registre/libelles";
import { CourbeSvg, COULEUR_TEMP } from "./CourbeSvg";
import { iconeLigne, tonLigne, useJson, type ReponseSalle } from "./commun";
import { NoteDialog } from "./NoteDialog";

// ============================================================
// Sur téléphone, après le code QR (V12) : la mesure actuelle, les
// 24 dernières heures et les dernières lignes du registre, en tête
// de fiche. Ne charge rien sur un écran large.
// ============================================================

export function ResumeTerrain({
  salleId,
  noms,
  onVoirRegistre,
  peutNoter = false,
}: {
  salleId: string;
  noms: Record<string, string>;
  onVoirRegistre: () => void;
  /** Gestionnaire ou administrateur : « Ajouter une note » sur place (lot 5). */
  peutNoter?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [petit, setPetit] = useState(false);
  const [noter, setNoter] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setPetit(mq.matches);
    const ecoute = (e: MediaQueryListEvent) => setPetit(e.matches);
    mq.addEventListener("change", ecoute);
    return () => mq.removeEventListener("change", ecoute);
  }, []);
  const base = `/api/salles/${encodeURIComponent(salleId)}/registre`;
  const mesures = useJson<ReponseSalle>(petit ? `${base}?vue=mesures&periode=24h` : null);
  const registre = useJson<ReponseSalle>(petit ? `${base}?vue=registre&periode=3m` : null);
  if (!petit) return null;

  const m = mesures.data;
  const c = m?.capteurs.find((x) => x.depuis != null && (x.derniereC != null || x.derniereH != null));
  const s = m?.stats;
  const courbe = m?.courbes?.capteurs[0];
  const lignes = (registre.data?.lignes ?? []).slice(0, 3);
  const f: Formats = { t, locale, noms };
  return (
    <div className="card p-4 space-y-3 sm:hidden">
      {/* Entretien (lot 5) : signaler un problème avec une photo, ou faire l'entretien prévu. */}
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/salles/${encodeURIComponent(salleId)}/signaler`} className="btn-ghost justify-center border border-red-200 bg-red-50 text-red-700 text-xs py-3">
          <AlertTriangle className="w-4 h-4" />
          {t("signaler.titre")}
        </Link>
        <Link href={`/salles/${encodeURIComponent(salleId)}/entretien`} className="btn-ghost justify-center border border-chanv-fibre text-xs py-3">
          <Hammer className="w-4 h-4" />
          {t("terrain.faireEntretien")}
        </Link>
      </div>
      {c && m && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{t("terrain.dernieres24h")}</div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-chanv-terre">
              {c.derniereC != null ? `${nombre(c.derniereC, locale)}°` : "—"}
            </span>
            {c.derniereH != null && <span className="text-lg font-semibold text-chanv-terre">{nombre(c.derniereH, locale, 0)} %</span>}
            {c.derniereA && (
              <span className="text-xs text-slate-400">
                {t("terrain.a", { h: heure(Date.parse(c.derniereA.replace(" ", "T") + (/[zZ]$/.test(c.derniereA) ? "" : "Z")), locale) })}
              </span>
            )}
          </div>
          {courbe && courbe.c.length > 1 && (
            <CourbeSvg
              mini
              hauteur={60}
              largeur={320}
              du={m.bornes.du}
              au={Math.min(m.bornes.au, m.maintenant)}
              unite="°C"
              locale={locale}
              titre={t("terrain.courbe")}
              plage={{ min: m.plages.tempMin, max: m.plages.tempMax }}
              series={[{ nom: courbe.nom, couleur: COULEUR_TEMP, points: courbe.c }]}
            />
          )}
          {s && s.c.min && (
            <div className="text-xs text-slate-500">
              {t("terrain.resume", {
                tmin: nombre(s.c.min.v, locale),
                tmax: nombre(s.c.max!.v, locale),
                hmin: s.h.min ? nombre(s.h.min.v, locale, 0) : "—",
                hmax: s.h.max ? nombre(s.h.max.v, locale, 0) : "—",
                recus: s.recus,
                attendus: s.attendus,
              })}
            </div>
          )}
        </div>
      )}
      {lignes.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-chanv-fibre">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold pt-2">{t("tabs.registre")}</div>
          {lignes.map((l) => {
            const Icone = iconeLigne(l);
            return (
              <div key={l.id} className="flex items-start gap-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tonLigne(l)}`}>
                  <Icone className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1 text-xs text-chanv-terre">
                  <div className="truncate">{decrireLigne(l, f).titre}</div>
                  <div className="text-slate-400">
                    {dateCourte(l.t, locale, false)}
                    {!l.jourSeulement && ` · ${heure(l.t, locale)}`}
                    {l.parNom && ` · ${l.parNom}`}
                  </div>
                </div>
              </div>
            );
          })}
          <button onClick={onVoirRegistre} className="btn-ghost w-full border border-chanv-fibre text-xs">
            {t("terrain.voirTout")}
          </button>
        </div>
      )}
      {peutNoter && (
        <button onClick={() => setNoter(true)} className="btn-primary w-full text-xs">
          <NotebookPen className="w-4 h-4" />
          {t("note.ajouter")}
        </button>
      )}
      {noter && (
        <NoteDialog
          salleId={salleId}
          nomSalle={noms[salleId] ? `${salleId} · ${noms[salleId]}` : salleId}
          onClose={() => setNoter(false)}
          onFait={() => {
            setNoter(false);
            registre.recharger();
          }}
        />
      )}
    </div>
  );
}
