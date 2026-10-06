"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, Plus, X } from "lucide-react";
import { useGandalf } from "@bleuh-co/gandalf-sdk-next/client";
import { useLocale, useT } from "@/lib/i18n";
import { nombre } from "@/lib/registre/libelles";
import { ChoixPeriode, urlPeriode, useJson, type Periode } from "./commun";
import { Champ, CLASSE_CHAMP, Fenetre } from "./Fenetre";

// ============================================================
// Fenêtre « Exporter le registre » (V6) : salles, période, contenu,
// format et langue. La taille de chaque contenu s'affiche avant
// l'export. Excel = téléchargement ; PDF = version imprimable (V8)
// dans un nouvel onglet, à enregistrer en PDF depuis l'impression.
// Mode « plusieurs salles » (Administration › Registre, V10) : par
// famille ou toutes les salles.
// ============================================================

export interface SalleChoix {
  id: string;
  nomSalle: string;
  famille: string;
}

interface Props {
  salles: SalleChoix[];
  /** Une salle (onglet Registre) : la salle de départ. Absent = mode plusieurs salles. */
  salleId?: string;
  onClose: () => void;
}

interface Estimation {
  salles: number;
  journal: number;
  jours: number;
  releves: number;
  heures: number;
}

export function ExportDialog({ salles, salleId, onClose }: Props) {
  const t = useT();
  const locale = useLocale();
  const { lang } = useGandalf();
  const plusieurs = !salleId;
  const [choisies, setChoisies] = useState<string[]>(salleId ? [salleId] : []);
  const [famille, setFamille] = useState<string>("__toutes__");
  const [ajout, setAjout] = useState("");
  const [periode, setPeriode] = useState<Periode>({ code: "30j" });
  const [journal, setJournal] = useState(true);
  const [parJour, setParJour] = useState(true);
  const [mesures, setMesures] = useState<"tous" | "heure" | "aucune">(plusieurs ? "aucune" : "heure");
  const [actifs, setActifs] = useState(true);
  const [capteurs, setCapteurs] = useState(true);
  const [format, setFormat] = useState<"xlsx" | "pdf">("xlsx");
  const [langue, setLangue] = useState<string>(lang || "fr");

  const familles = useMemo(() => [...new Set(salles.map((s) => s.famille).filter(Boolean))].sort(), [salles]);
  const ids = plusieurs
    ? salles.filter((s) => famille === "__toutes__" || s.famille === famille).map((s) => s.id)
    : choisies;

  const params = useMemo(() => {
    const q = new URLSearchParams(urlPeriode(periode));
    q.set("salles", ids.join("|"));
    q.set("journal", journal ? "1" : "0");
    q.set("parJour", parJour ? "1" : "0");
    q.set("mesures", mesures);
    q.set("actifs", actifs ? "1" : "0");
    q.set("capteurs", capteurs ? "1" : "0");
    q.set("lang", langue);
    return q.toString();
  }, [periode, ids, journal, parJour, mesures, actifs, capteurs, langue]);

  const estimation = useJson<Estimation>(ids.length && ids.length <= 40 ? `/api/registre/export?estimer=1&${params}` : null);
  const e = estimation.data;
  const n = (v: number | undefined) => (v == null ? "…" : nombre(v, locale, 0));

  const exporter = () => {
    if (!ids.length) return;
    if (format === "pdf") window.open(`/registre/imprimer?${params}`, "_blank", "noopener");
    else window.location.href = `/api/registre/export?${params}`;
    onClose();
  };

  const coche = (v: boolean, set: (b: boolean) => void, libelle: React.ReactNode) => (
    <label className="flex items-start gap-2 text-sm text-chanv-terre">
      <input type="checkbox" checked={v} onChange={(x) => set(x.target.checked)} className="mt-1" />
      <span>{libelle}</span>
    </label>
  );

  return (
    <Fenetre
      large
      titre={
        <span className="inline-flex items-center gap-2">
          <Download className="w-4 h-4" /> {t("export.titre")}
        </span>
      }
      onClose={onClose}
      pied={
        <>
          <span className="mr-auto text-[11px] text-slate-500">{t("export.inscrit")}</span>
          <button onClick={onClose} className="btn-ghost text-xs">{t("actifsSalle.annuler")}</button>
          <button onClick={exporter} disabled={!ids.length} className="btn-primary text-xs">
            <Download className="w-4 h-4" /> {t("export.exporter")}
          </button>
        </>
      }
    >
      <Champ libelle={plusieurs ? t("export.salles") : t("export.salle")}>
        {plusieurs ? (
          <select value={famille} onChange={(x) => setFamille(x.target.value)} className={CLASSE_CHAMP}>
            <option value="__toutes__">{t("export.toutesLesSalles", { n: salles.length })}</option>
            {familles.map((fa) => (
              <option key={fa} value={fa}>
                {t("export.famille", { famille: fa, n: salles.filter((s) => s.famille === fa).length })}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {choisies.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-chanv-fibre text-xs text-chanv-terre">
                {id}
                {salles.find((s) => s.id === id)?.nomSalle ? ` · ${salles.find((s) => s.id === id)!.nomSalle}` : ""}
                {id !== salleId && (
                  <button onClick={() => setChoisies(choisies.filter((x) => x !== id))} aria-label={t("export.retirerSalle")}>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
            {choisies.length < 10 && (
              <span className="inline-flex items-center gap-1">
                <select value={ajout} onChange={(x) => setAjout(x.target.value)} className="text-xs border border-chanv-fibre rounded-lg px-2 py-1 bg-white max-w-[14rem]">
                  <option value="">{t("export.ajouterSalle")}</option>
                  {salles
                    .filter((s) => !choisies.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nomSalle ? `${s.nomSalle} (${s.id})` : s.id}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => {
                    if (ajout) setChoisies([...choisies, ajout]);
                    setAjout("");
                  }}
                  disabled={!ajout}
                  className="p-1 rounded-lg border border-chanv-fibre disabled:opacity-40"
                  aria-label={t("export.ajouterSalle")}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>
        )}
      </Champ>

      <Champ libelle={t("export.periode")}>
        <ChoixPeriode valeur={periode} codes={["7j", "30j", "3m", "12m", "perso"]} onChange={setPeriode} />
      </Champ>

      <div>
        <span className="block text-xs font-semibold text-slate-500 mb-1.5">
          {t("export.contenu")}
          {estimation.chargement && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin" />}
        </span>
        <div className="space-y-1.5">
          {coche(journal, setJournal, <>{t("export.journal")} <span className="text-slate-400">— {t("export.nLignes", { n: n(e?.journal) })}</span></>)}
          {coche(parJour, setParJour, <>{t("export.parJour")} <span className="text-slate-400">— {t("export.nLignes", { n: n(e?.jours) })}</span></>)}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-chanv-terre pl-6">
            <span className="text-slate-500">{t("export.mesures")} :</span>
            {(["tous", "heure", "aucune"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1.5">
                <input type="radio" name="mesures" checked={mesures === m} onChange={() => setMesures(m)} />
                {t(`export.mesures.${m}`)}
                {m === "tous" && <span className="text-slate-400">({n(e?.releves)})</span>}
                {m === "heure" && <span className="text-slate-400">({n(e?.heures)})</span>}
              </label>
            ))}
          </div>
          {coche(actifs, setActifs, t("export.actifs"))}
          {coche(capteurs, setCapteurs, t("export.capteurs"))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Champ libelle={t("export.format")}>
          <div className="space-y-1 text-sm text-chanv-terre">
            <label className="flex items-center gap-2">
              <input type="radio" name="format" checked={format === "xlsx"} onChange={() => setFormat("xlsx")} />
              {t(plusieurs ? "export.formatExcelPlusieurs" : "export.formatExcel")}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="format" checked={format === "pdf"} onChange={() => setFormat("pdf")} />
              {t(plusieurs ? "export.formatPdfPlusieurs" : "export.formatPdf")}
            </label>
          </div>
        </Champ>
        <Champ libelle={t("export.langue")}>
          <select value={langue} onChange={(x) => setLangue(x.target.value)} className={CLASSE_CHAMP}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </Champ>
      </div>
      {plusieurs && ids.length > 40 && <p className="text-[11px] text-slate-500">{t("export.grosExport", { n: ids.length })}</p>}
    </Fenetre>
  );
}
