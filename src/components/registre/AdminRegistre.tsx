"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { auteurLigne, dateHeure, dateCourte, decrireLigne, type Formats } from "@/lib/registre/libelles";
import type { Bornes } from "@/lib/registre/periode";
import type { LigneRegistre, SorteLigne } from "@/lib/registre/types";
import { ChoixPeriode, iconeLigne, tonLigne, urlPeriode, useJson, type Periode } from "./commun";
import { ExportDialog, type SalleChoix } from "./ExportDialog";

// ============================================================
// Administration › Registre (V10) : le registre de plusieurs salles,
// filtré par salle, sorte, période et personne, avec l'export groupé.
// Remplace l'ancien « Journal », qui reste consultable en dessous.
// ============================================================

interface Reponse {
  bornes: Bornes;
  lignes: LigneRegistre[];
  tronque: boolean;
  noms: Record<string, string>;
}

const SORTES: (SorteLigne | "tout")[] = ["tout", "fiche", "actif", "item", "capteur", "entretien", "note", "export"];

export function AdminRegistre({ salles, journalTechnique }: { salles: SalleChoix[]; journalTechnique: React.ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const [periode, setPeriode] = useState<Periode>({ code: "30j" });
  const [famille, setFamille] = useState("");
  const [salle, setSalle] = useState("");
  const [sorte, setSorte] = useState<SorteLigne | "tout">("tout");
  const [personne, setPersonne] = useState("");
  const [exporter, setExporter] = useState(false);
  const [technique, setTechnique] = useState(false);

  const q = new URLSearchParams(urlPeriode(periode));
  if (famille) q.set("famille", famille);
  if (salle) q.set("salle", salle);
  const { data, chargement, erreur } = useJson<Reponse>(`/api/admin/registre?${q}`);
  const f: Formats = { t, locale, noms: data?.noms };
  const familles = useMemo(() => [...new Set(salles.map((s) => s.famille).filter(Boolean))].sort(), [salles]);
  const personnes = useMemo(
    () => [...new Set((data?.lignes ?? []).map((l) => auteurLigne(l, t)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [data, t]
  );
  const lignes = (data?.lignes ?? []).filter(
    (l) => (sorte === "tout" || l.sorte === sorte) && (!personne || auteurLigne(l, t) === personne)
  );

  const select = "text-xs border border-chanv-fibre rounded-lg px-2 py-1.5 bg-white";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={famille} onChange={(e) => { setFamille(e.target.value); setSalle(""); }} className={select} aria-label={t("adminRegistre.famille")}>
          <option value="">{t("adminRegistre.toutesFamilles")}</option>
          {familles.map((x) => (
            <option key={x} value={x}>{x}</option>
          ))}
        </select>
        <select value={salle} onChange={(e) => setSalle(e.target.value)} className={`${select} max-w-[14rem]`} aria-label={t("adminRegistre.salle")}>
          <option value="">{t("adminRegistre.toutesSalles")}</option>
          {salles
            .filter((s) => !famille || s.famille === famille)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.nomSalle ? `${s.nomSalle} (${s.id})` : s.id}
              </option>
            ))}
        </select>
        <select value={sorte} onChange={(e) => setSorte(e.target.value as SorteLigne | "tout")} className={select} aria-label={t("adminRegistre.sorte")}>
          {SORTES.map((x) => (
            <option key={x} value={x}>{t(`sorte.${x}`)}</option>
          ))}
        </select>
        <select value={personne} onChange={(e) => setPersonne(e.target.value)} className={select} aria-label={t("adminRegistre.personne")}>
          <option value="">{t("adminRegistre.toutesPersonnes")}</option>
          {personnes.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button onClick={() => setExporter(true)} className="btn-ghost border border-chanv-fibre text-xs ml-auto">
          <Download className="w-4 h-4" /> {t("adminRegistre.exporter")}
        </button>
      </div>
      <ChoixPeriode valeur={periode} codes={["7j", "30j", "3m", "12m", "perso"]} onChange={setPeriode} />

      {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      {!data && chargement && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
        </div>
      )}
      {data && (
        <div className={`section-card overflow-hidden transition-opacity ${chargement ? "opacity-60" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-chanv-fibre text-left">
                  {["colQuand", "colSalle", "colLigne", "colPar"].map((k) => (
                    <th key={k} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t(`adminRegistre.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const Icone = iconeLigne(l);
                  const d = decrireLigne(l, f);
                  return (
                    <tr key={`${l.salleId}-${l.id}`} className="border-b border-chanv-fibre/50 align-top">
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{l.jourSeulement ? dateCourte(l.t, locale) : dateHeure(l.t, locale)}</td>
                      <td className="px-3 py-2 text-xs text-chanv-terre whitespace-nowrap">
                        {l.salleId ? (
                          <a href={`/salles/${encodeURIComponent(l.salleId)}#registre`} className="hover:underline">{l.salleId}</a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-start gap-2">
                          <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${tonLigne(l)}`}>
                            <Icone className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs text-chanv-terre">{d.titre}</div>
                            {d.detail && <div className="text-[11px] text-slate-500">{d.detail}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{auteurLigne(l, t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-2 text-xs text-slate-400 border-t border-chanv-fibre">
            {t("adminRegistre.nLignes", { n: lignes.length })}
            {data.tronque && ` · ${t("adminRegistre.tronque")}`}
            {" · "}
            {t("adminRegistre.ecartsParSalle")}
          </div>
        </div>
      )}

      <div>
        <button onClick={() => setTechnique(!technique)} className="text-xs text-slate-500 underline decoration-dotted">
          {t(technique ? "adminRegistre.masquerJournal" : "adminRegistre.voirJournal")}
        </button>
        {technique && <div className="mt-3">{journalTechnique}</div>}
      </div>

      {exporter && <ExportDialog salles={salles} onClose={() => setExporter(false)} />}
    </div>
  );
}
