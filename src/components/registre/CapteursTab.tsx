"use client";

import { useMemo, useState } from "react";
import { Battery, Loader2, Wifi, WifiOff } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { dateCourte, heure, nombre, plageTexte, type Formats } from "@/lib/registre/libelles";
import { jourDe } from "@/lib/registre/temps";
import type { CourbeCapteur } from "@/lib/registre/service";
import { Courbe } from "./Courbe";
import { COULEUR_HUM, COULEUR_TEMP, couleurCapteur, type SerieCourbe } from "./CourbeSvg";
import { ChoixPeriode, urlPeriode, useJson, type Periode, type ReponseSalle } from "./commun";

// ============================================================
// Onglet « Capteurs » (V2, V3) : courbes de la période, plage de la
// salle en vert, résumé par jour. Plusieurs capteurs : un trait par
// capteur (pastilles pour masquer / montrer) ou la moyenne de la salle.
// ============================================================

const MIDI = 12 * 3600_000;

function serie(c: CourbeCapteur, g: "c" | "h", nom: string, couleur: string): SerieCourbe {
  const jours = g === "c" ? c.cJour : c.hJour;
  if (jours) {
    return {
      nom,
      couleur,
      points: jours.map((j) => ({ t: j.t + MIDI, v: j.moy })),
      bande: jours.map((j) => ({ t: j.t + MIDI, min: j.min, max: j.max })),
    };
  }
  return { nom, couleur, points: g === "c" ? c.c : c.h };
}

export function CapteursTab({ salleId }: { salleId: string }) {
  const t = useT();
  const locale = useLocale();
  const f: Formats = { t, locale };
  const [periode, setPeriode] = useState<Periode>({ code: "7j" });
  const [grandeur, setGrandeur] = useState<"c" | "h">("c");
  const [masques, setMasques] = useState<Set<string>>(new Set());
  const [moyenne, setMoyenne] = useState(false);
  const { data, chargement, erreur } = useJson<ReponseSalle>(
    `/api/salles/${encodeURIComponent(salleId)}/registre?vue=mesures&${urlPeriode(periode)}`
  );
  const courbes = data?.courbes;
  // Couleur attachée au capteur (ordre fixe), jamais à son rang à l'écran.
  const rangs = useMemo(
    () => new Map((data?.capteurs ?? []).map((c, i) => [c.sensorId, i])),
    [data]
  );

  const du = data?.bornes.du ?? 0;
  const au = data ? Math.min(data.bornes.au, data.maintenant) : 1;
  const pas = courbes?.pas ?? "heure";
  const plageC = data ? { min: data.plages.tempMin, max: data.plages.tempMax } : null;
  const plageH = data ? { min: data.plages.humMin, max: data.plages.humMax } : null;
  const plusieurs = (courbes?.capteurs.length ?? 0) > 1;
  const s = data?.stats;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChoixPeriode valeur={periode} codes={["24h", "7j", "30j", "3m", "perso"]} onChange={setPeriode} />
        {plusieurs && (
          <div className="flex items-center gap-1.5">
            {(["c", "h"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGrandeur(g)}
                aria-pressed={grandeur === g}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  grandeur === g ? "bg-chanv-terre text-white border-chanv-terre" : "bg-white text-slate-600 border-chanv-fibre"
                }`}
              >
                {t(g === "c" ? "tabs.temperature" : "tabs.humidity")}
              </button>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-slate-600 ml-2">
              <input type="checkbox" checked={moyenne} onChange={(e) => setMoyenne(e.target.checked)} />
              {t("capteurs.moyenneSalle")}
            </label>
          </div>
        )}
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!data && chargement && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
        </div>
      )}

      {data && (
        <div className={`space-y-4 transition-opacity ${chargement ? "opacity-60" : ""}`}>
          {/* Capteurs de la salle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.capteurs.map((c) => (
              <div key={c.sensorId} className="section-card p-3 flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.enLigne === false ? "bg-red-50" : "bg-green-50"}`}>
                  {c.enLigne === false ? <WifiOff className="w-4 h-4 text-red-500" /> : <Wifi className="w-4 h-4 text-green-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {plusieurs && (
                      <span className="inline-block w-3 h-0.5 rounded shrink-0" style={{ background: couleurCapteur(rangs.get(c.sensorId) ?? 0) }} />
                    )}
                    <span className="text-sm font-bold text-chanv-terre truncate">{c.nom}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.enLigne === false ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
                      {c.enLigne === false ? t("tabs.offline") : t("tabs.online")}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.depuis != null
                      ? t(c.confirme ? "capteurs.dansLaSalleDepuis" : "capteurs.dansLaSalleDepuisAConfirmer", { date: dateCourte(c.depuis, locale) })
                      : t("capteurs.plusDansLaSalle")}
                    {" · "}
                    {t("capteurs.intervalle", { n: Math.round(c.intervalleS / 60) })}
                    {c.batterie != null && (
                      <span className="inline-flex items-center gap-0.5 ml-1">
                        · <Battery className="w-3 h-3" /> {Math.round(c.batterie)} %
                      </span>
                    )}
                  </div>
                </div>
                {c.depuis != null && (c.derniereC != null || c.derniereH != null) && (
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-chanv-terre">
                      {c.derniereC != null && `${nombre(c.derniereC, locale)}°`}
                      {c.derniereH != null && <span className="ml-1.5">{nombre(c.derniereH, locale, 0)} %</span>}
                    </div>
                    {c.derniereA && <div className="text-[10px] text-slate-400">{heure(Date.parse(c.derniereA.replace(" ", "T") + (/[zZ]$/.test(c.derniereA) ? "" : "Z")), locale)}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {data.incomplet && <p className="text-xs text-amber-700">{t("registre.incomplet")}</p>}

          {/* Courbes */}
          {courbes && courbes.capteurs.length > 0 ? (
            plusieurs ? (
              <div className="section-card p-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {courbes.capteurs.map((c) => {
                    const info = data.capteurs.find((x) => x.sensorId === c.sensorId);
                    const v = grandeur === "c" ? info?.derniereC : info?.derniereH;
                    const cache = masques.has(c.sensorId);
                    return (
                      <button
                        key={c.sensorId}
                        onClick={() =>
                          setMasques((m) => {
                            const n = new Set(m);
                            if (n.has(c.sensorId)) n.delete(c.sensorId);
                            else n.add(c.sensorId);
                            return n;
                          })
                        }
                        aria-pressed={!cache}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
                          cache ? "border-chanv-fibre text-slate-400 line-through" : "border-chanv-beige text-chanv-terre bg-chanv-fibre/40"
                        }`}
                      >
                        <span className="inline-block w-3 h-0.5 rounded" style={{ background: couleurCapteur(rangs.get(c.sensorId) ?? 0) }} />
                        {c.nom}
                        {v != null && ` · ${nombre(v, locale, grandeur === "c" ? 1 : 0)}${grandeur === "c" ? "°" : " %"}`}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-slate-500">
                  {t(grandeur === "c" ? "capteurs.titreTemp" : "capteurs.titreHum")} · {t(`capteurs.pas.${pas}`)}
                  {" · "}
                  {plageTexte(grandeur === "c" ? data.plages.tempMin : data.plages.humMin, grandeur === "c" ? data.plages.tempMax : data.plages.humMax, grandeur === "c" ? "°C" : "%", f)}
                </div>
                <Courbe
                  titre={t(grandeur === "c" ? "capteurs.titreTemp" : "capteurs.titreHum")}
                  du={du}
                  au={au}
                  unite={grandeur === "c" ? "°C" : "%"}
                  locale={locale}
                  parJour={pas === "jour"}
                  hauteur={240}
                  plage={grandeur === "c" ? plageC : plageH}
                  series={
                    moyenne && courbes.moyenne
                      ? [{ nom: t("capteurs.moyenneSalle"), couleur: grandeur === "c" ? COULEUR_TEMP : COULEUR_HUM, points: courbes.moyenne[grandeur] }]
                      : courbes.capteurs
                          .filter((c) => !masques.has(c.sensorId))
                          .map((c) => serie(c, grandeur, c.nom, couleurCapteur(rangs.get(c.sensorId) ?? 0)))
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {(["c", "h"] as const).map((g) => {
                  const c = courbes.capteurs[0];
                  const ag = g === "c" ? s?.c : s?.h;
                  return (
                    <div key={g} className="section-card p-4 space-y-2">
                      <div className="text-xs text-slate-500">
                        <strong className="text-chanv-terre">{t(g === "c" ? "capteurs.titreTemp" : "capteurs.titreHum")}</strong>
                        {" · "}
                        {t(`capteurs.pas.${pas}`)}
                        {ag?.min && ` · ${t("capteurs.minMax", { min: nombre(ag.min.v, locale), max: nombre(ag.max!.v, locale) })}`}
                        {" · "}
                        {t("capteurs.plage", {
                          plage: plageTexte(g === "c" ? data.plages.tempMin : data.plages.humMin, g === "c" ? data.plages.tempMax : data.plages.humMax, g === "c" ? "°C" : "%", f),
                        })}
                      </div>
                      <Courbe
                        titre={t(g === "c" ? "capteurs.titreTemp" : "capteurs.titreHum")}
                        du={du}
                        au={au}
                        unite={g === "c" ? "°C" : "%"}
                        locale={locale}
                        parJour={pas === "jour"}
                        plage={g === "c" ? plageC : plageH}
                        series={[serie(c, g, c.nom, g === "c" ? COULEUR_TEMP : COULEUR_HUM)]}
                      />
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">{t("capteurs.aucuneMesure")}</p>
          )}

          {/* Résumé par jour (le tableau qui double les courbes) */}
          {courbes && courbes.parJour.length > 0 && (
            <div className="section-card overflow-hidden">
              <div className="px-4 pt-3 text-sm font-bold text-chanv-terre">{t("capteurs.resumeParJour")}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-chanv-fibre text-left">
                      {["colJour", "colReleves", "colTMin", "colTMax", "colTMoy", "colHr", "colHorsPlage"].map((k) => (
                        <th key={k} className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                          {t(`capteurs.${k}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {courbes.parJour.map((r) => (
                      <tr key={r.jour} className="border-b border-chanv-fibre/50">
                        <td className="px-3 py-1.5 text-chanv-terre whitespace-nowrap">
                          {dateCourte(Date.parse(`${r.jour}T16:00:00Z`), locale, false)}
                          {r.jour === jourDe(data.maintenant) && (
                            <span className="text-slate-400 text-xs"> ({t("capteurs.jusqua", { h: heure(data.maintenant, locale) })})</span>
                          )}
                        </td>
                        <td className={`px-3 py-1.5 ${r.recus < r.attendus * 0.9 ? "text-amber-700 font-semibold" : "text-slate-600"}`}>
                          {r.recus} / {r.attendus}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">{nombre(r.cMin, locale)}</td>
                        <td className="px-3 py-1.5 text-slate-600">{nombre(r.cMax, locale)}</td>
                        <td className="px-3 py-1.5 text-slate-600">{nombre(r.cMoy, locale)}</td>
                        <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                          {r.hMin != null ? `${nombre(r.hMin, locale, 0)} – ${nombre(r.hMax, locale, 0)} %` : "—"}
                        </td>
                        <td className={`px-3 py-1.5 ${r.minutesHorsPlage ? "text-amber-700 font-semibold" : "text-slate-600"}`}>
                          {t("duree.minutes", { n: r.minutesHorsPlage })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
