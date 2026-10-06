"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, MessageSquareText, MessageSquareWarning, NotebookPen, Thermometer, X } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { auteurLigne, dateCourte, dateHeure, dateLongue, decrireLigne, duree, heure, nombre, plageTexte, type Formats } from "@/lib/registre/libelles";
import { jourDe } from "@/lib/registre/temps";
import type { LigneRegistre, SorteLigne } from "@/lib/registre/types";
import type { VueJustification } from "@/lib/registre/service";
import { ChoixPeriode, Encart, iconeLigne, tonLigne, urlPeriode, useJson, type Periode, type ReponseSalle } from "./commun";
import { JustifierDialog, NoteDialog } from "./NoteDialog";

// ============================================================
// Onglet « Registre » d'une salle (V1, V11) : la ligne du temps de
// la salle, les chiffres de la période et les filtres par sorte.
// ============================================================

const SORTES: (SorteLigne | "tout")[] = ["tout", "fiche", "actif", "item", "capteur", "ecart", "note", "export"];

export interface FiltreCible {
  id: string;
  nom: string;
  /** Item agricole (sinon actif). */
  item?: boolean;
}

interface Props {
  salleId: string;
  noms: Record<string, string>;
  filtreActif?: FiltreCible | null;
  onEffacerFiltre?: () => void;
  onExporter: () => void;
  /** Gestionnaire ou administrateur : notes et justification des écarts (lot 5). */
  peutNoter?: boolean;
}

export function RegistreTab({ salleId, noms, filtreActif, onEffacerFiltre, onExporter, peutNoter = false }: Props) {
  const t = useT();
  const locale = useLocale();
  const [periode, setPeriode] = useState<Periode>({ code: "tout" });
  const [sorte, setSorte] = useState<SorteLigne | "tout">("tout");
  const [noter, setNoter] = useState(false);
  const [aJustifier, setAJustifier] = useState<LigneRegistre | null>(null);
  const { data, chargement, erreur, recharger } = useJson<ReponseSalle>(
    `/api/salles/${encodeURIComponent(salleId)}/registre?vue=registre&${urlPeriode(periode)}`
  );
  const f: Formats = { t, locale, noms };

  const lignes = useMemo(
    () => (data?.lignes ?? []).filter((l) => !filtreActif || l.cible?.id === filtreActif.id),
    [data, filtreActif]
  );
  const compte = (s: SorteLigne | "tout") => (s === "tout" ? lignes.length : lignes.filter((l) => l.sorte === s).length);
  // Items agricoles : le filtre n'apparaît que dans une salle qui en a eu.
  const sortes = SORTES.filter((x) => x !== "item" || compte("item") > 0 || sorte === "item");
  const visibles = sorte === "tout" ? lignes : lignes.filter((l) => l.sorte === sorte);
  const jours = useMemo(() => {
    const g: { jour: string; t: number; lignes: LigneRegistre[] }[] = [];
    for (const l of visibles) {
      const j = jourDe(l.t);
      const der = g[g.length - 1];
      if (der && der.jour === j) der.lignes.push(l);
      else g.push({ jour: j, t: l.t, lignes: [l] });
    }
    return g;
  }, [visibles]);

  const s = data?.stats;
  const p = data?.plages;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ChoixPeriode valeur={periode} codes={["7j", "30j", "3m", "tout", "perso"]} onChange={setPeriode} />
        <div className="flex flex-wrap items-center gap-2">
          {peutNoter && (
            <button onClick={() => setNoter(true)} className="btn-ghost border border-chanv-fibre text-xs">
              <NotebookPen className="w-4 h-4" />
              {t("note.ajouter")}
            </button>
          )}
          <button onClick={onExporter} className="btn-ghost border border-chanv-fibre text-xs">
            <Download className="w-4 h-4" />
            {t("registre.exporter")}
          </button>
        </div>
      </div>

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!data && chargement && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
        </div>
      )}

      {data && (
        <div className={`space-y-4 transition-opacity ${chargement ? "opacity-60" : ""}`}>
          {!data.aEuCapteur ? (
            <div className="section-card p-4 flex items-start gap-3 border-l-4 border-l-amber-400">
              <Thermometer className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-chanv-terre">
                <strong>{t("registre.sansCapteur")}</strong>
                <p className="text-slate-600 mt-0.5">
                  {data.conditions ? `${t("registre.conditionsAttendues", { conditions: data.conditions })} ` : ""}
                  {t("registre.sansCapteurSuite")}
                </p>
              </div>
            </div>
          ) : s ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Encart
                titre={t("tabs.temperature")}
                valeur={s.c.min ? `${nombre(s.c.min.v, locale)} – ${nombre(s.c.max!.v, locale)} °C` : "—"}
                sous={
                  <>
                    {s.c.moy != null && t("registre.moyenne", { v: `${nombre(s.c.moy, locale)} °C` })}
                    {s.depuis != null && ` · ${t("registre.depuisLe", { date: dateCourte(s.depuis, locale) })}`}
                  </>
                }
              />
              <Encart
                titre={t("tabs.humidity")}
                valeur={s.h.min ? `${nombre(s.h.min.v, locale, 0)} – ${nombre(s.h.max!.v, locale, 0)} %` : "—"}
                sous={s.h.moy != null ? t("registre.moyenne", { v: `${nombre(s.h.moy, locale, 0)} %` }) : undefined}
              />
              <Encart
                titre={t("registre.ecartsPlage")}
                valeur={p && (p.tempMin != null || p.tempMax != null || p.humMin != null || p.humMax != null) ? s.ecarts : "—"}
                sous={
                  p && (p.tempMin != null || p.tempMax != null)
                    ? t("registre.plageCourte", { plage: plageTexte(p.tempMin, p.tempMax, "°C", f) })
                    : t("registre.aucunePlage")
                }
              />
              <Encart
                titre={t("registre.donneesManquantes")}
                valeur={s.muets ? t("registre.silences", { n: s.muets, duree: duree(s.dureeMuetMin, t) }) : t("registre.aucune")}
                sous={t("registre.relevesRecus", { recus: nombre(s.recus, locale, 0), attendus: nombre(s.attendus, locale, 0) })}
              />
            </div>
          ) : (
            <p className="text-xs text-slate-500">{t("registre.aucuneMesurePeriode")}</p>
          )}
          {data.incomplet && <p className="text-xs text-amber-700">{t("registre.incomplet")}</p>}

          <div className="flex flex-wrap items-center gap-1.5">
            {sortes.map((x) => (
              <button
                key={x}
                onClick={() => setSorte(x)}
                aria-pressed={sorte === x}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                  sorte === x ? "bg-chanv-fibre border-chanv-beige text-chanv-terre" : "border-chanv-fibre text-slate-500 hover:bg-chanv-fibre/50"
                }`}
              >
                {t(`sorte.${x}`)} <span className="font-bold">{compte(x)}</span>
              </button>
            ))}
            {filtreActif && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-chanv-terre text-white">
                {t(filtreActif.item ? "registre.filtreItem" : "registre.filtreActif", { nom: filtreActif.nom })}
                <button onClick={onEffacerFiltre} aria-label={t("registre.effacerFiltre")}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {jours.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">{t("registre.aucuneLigne")}</p>
          ) : (
            <div className="space-y-5">
              {jours.map((g) => (
                <div key={g.jour}>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{dateLongue(g.t, locale)}</div>
                  <div className="space-y-2">
                    {g.lignes.map((l) => {
                      const Icone = iconeLigne(l);
                      // À l'écran, chaque justification a sa ligne sous l'écart (Excel et imprimé : à la suite).
                      const justifs = (l.details?.justifications as VueJustification[] | undefined) ?? [];
                      const d = decrireLigne(justifs.length ? { ...l, details: { ...l.details, justifications: [] } } : l, f);
                      const justifiable = peutNoter && l.type === "ecart" && !!l.cible?.id;
                      const justifie = justifs.length > 0;
                      return (
                        <div key={l.id} className="section-card p-3 flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tonLigne(l)}`}>
                            <Icone className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-chanv-terre break-words">{d.titre}</div>
                            {d.detail && <div className="text-xs text-slate-500 mt-0.5 break-words">{d.detail}</div>}
                            {justifs.map((j, i) => (
                              <div key={i} className="mt-1 flex items-start gap-1.5 text-xs text-chanv-terre break-words">
                                <MessageSquareText className="w-3.5 h-3.5 shrink-0 mt-px text-amber-700" />
                                <span>{t("ligne.justifie", { nom: j.parNom, date: dateHeure(j.inscritA, locale), texte: j.texte })}</span>
                              </div>
                            ))}
                            {justifiable && (
                              <button
                                onClick={() => setAJustifier(l)}
                                className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline"
                              >
                                <MessageSquareWarning className="w-3.5 h-3.5" />
                                {t(justifie ? "ecart.completer" : "ecart.justifier")}
                              </button>
                            )}
                          </div>
                          <div className="text-right shrink-0 text-[11px] text-slate-400 leading-tight">
                            <div>{l.jourSeulement ? t("registre.dansLaJournee") : heure(l.t, locale)}</div>
                            <div className="max-w-[9rem] truncate">{auteurLigne(l, t)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {noter && (
        <NoteDialog
          salleId={salleId}
          nomSalle={noms[salleId] ? `${salleId} · ${noms[salleId]}` : salleId}
          onClose={() => setNoter(false)}
          onFait={() => {
            setNoter(false);
            recharger();
          }}
        />
      )}
      {aJustifier && (
        <JustifierDialog
          salleId={salleId}
          ligne={aJustifier}
          f={f}
          onClose={() => setAJustifier(null)}
          onFait={() => {
            setAJustifier(null);
            recharger();
          }}
        />
      )}
    </div>
  );
}
