"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeftRight,
  BadgeCheck,
  Ban,
  BookOpen,
  CalendarCog,
  CalendarPlus,
  CalendarX,
  Circle,
  Download,
  Flag,
  Hammer,
  Link2,
  LogIn,
  LogOut,
  MessageSquareWarning,
  NotebookPen,
  PackageMinus,
  PackagePlus,
  Pencil,
  Power,
  PowerOff,
  Radio,
  Share2,
  Sprout,
  SquarePlus,
  Target,
  Thermometer,
  Trash2,
  Undo2,
  Unlink,
  WifiOff,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import type { Bornes, CodePeriode } from "@/lib/registre/periode";
import type { LigneRegistre, PlagesSalle } from "@/lib/registre/types";
import type { Agregat } from "@/lib/registre/mesures";
import type { Courbes, InfoCapteur } from "@/lib/registre/service";

// ============================================================
// Briques communes des écrans du registre.
// ============================================================

export interface StatsResume {
  recus: number;
  attendus: number;
  c: Agregat;
  h: Agregat;
  depuis: number | null;
  ecarts: number;
  ecartsEnCours: number;
  muets: number;
  dureeMuetMin: number;
  plusLongTrouMin: number;
}

export interface ReponseSalle {
  salleId: string;
  conditions: string;
  plages: PlagesSalle;
  bornes: Bornes;
  maintenant: number;
  capteurs: InfoCapteur[];
  aEuCapteur: boolean;
  stats: StatsResume | null;
  incomplet: boolean;
  lignes?: LigneRegistre[];
  courbes?: Courbes;
}

export interface Periode {
  code: CodePeriode;
  du?: string;
  au?: string;
}

export function urlPeriode(p: Periode): string {
  const q = new URLSearchParams({ periode: p.code });
  if (p.code === "perso") {
    if (p.du) q.set("du", p.du);
    if (p.au) q.set("au", p.au);
  }
  return q.toString();
}

/** Lecture d'une route JSON ; garde l'ancienne réponse pendant le rechargement. */
export function useJson<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!url) return;
    const ctl = new AbortController();
    setChargement(true);
    fetch(url, { signal: ctl.signal })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        setData(d as T);
        setErreur(null);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setErreur(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!ctl.signal.aborted) setChargement(false);
      });
    return () => ctl.abort();
  }, [url, version]);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { data, chargement, erreur, recharger };
}

/** Choix de la période : préréglages d'abord, période personnalisée ensuite. */
export function ChoixPeriode({
  valeur,
  codes,
  onChange,
}: {
  valeur: Periode;
  codes: CodePeriode[];
  onChange: (p: Periode) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {codes.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c === "perso" ? { code: c, du: valeur.du, au: valeur.au } : { code: c })}
          aria-pressed={valeur.code === c}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            valeur.code === c
              ? "bg-chanv-terre text-white border-chanv-terre"
              : "bg-white text-slate-600 border-chanv-fibre hover:bg-chanv-fibre/50"
          }`}
        >
          {t(`periode.${c}`)}
        </button>
      ))}
      {valeur.code === "perso" && (
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="date"
            value={valeur.du ?? ""}
            onChange={(e) => onChange({ ...valeur, du: e.target.value })}
            className="border border-chanv-fibre rounded-lg px-2 py-1 bg-white text-xs"
            aria-label={t("periode.du")}
          />
          {t("periode.au")}
          <input
            type="date"
            value={valeur.au ?? ""}
            onChange={(e) => onChange({ ...valeur, au: e.target.value })}
            className="border border-chanv-fibre rounded-lg px-2 py-1 bg-white text-xs"
            aria-label={t("periode.auLibelle")}
          />
        </span>
      )}
    </div>
  );
}

const ICONES: Record<LigneRegistre["type"], LucideIcon> = {
  ouverture: BookOpen,
  salle_creee: SquarePlus,
  fiche_modifiee: Pencil,
  salle_archivee: Archive,
  salle_restauree: ArchiveRestore,
  salle_supprimee: Trash2,
  plage_modifiee: Target,
  actif_installe: Wrench,
  actif_ajoute: PackagePlus,
  actif_entre: LogIn,
  actif_sorti: LogOut,
  actif_retire: PackageMinus,
  actif_modifie: Pencil,
  actif_supprime: Trash2,
  actif_corrige: Link2,
  dessert_ajoute: Share2,
  dessert_retire: Share2,
  registre_exporte: Download,
  capteur_pose: Thermometer,
  capteur_parti: Unlink,
  capteur_nouveau: Radio,
  ecart: AlertTriangle,
  muet: WifiOff,
  note: NotebookPen,
  ecart_justifie: MessageSquareWarning,
  item_ajoute: Sprout,
  item_present: Sprout,
  item_entre: LogIn,
  item_sorti: LogOut,
  item_modifie: Pencil,
  item_supprime: Trash2,
  entretien_ajoute: CalendarPlus,
  entretien_modifie: CalendarCog,
  entretien_retire: CalendarX,
  probleme_signale: Flag,
  entretien_fait: Hammer,
  intervention_validee: BadgeCheck,
  intervention_refusee: Undo2,
  intervention_annulee: Ban,
  actif_hors_service: PowerOff,
  actif_remis_en_service: Power,
};

/** Icône d'une ligne ; une sorte inconnue (inscrite par une app plus récente) garde une icône. */
export function iconeLigne(l: LigneRegistre): LucideIcon {
  return ICONES[l.type] ?? Circle;
}

export const ICONE_DEPLACER = ArrowLeftRight;

/** Teinte de l'icône d'une ligne (les écarts portent toujours icône + texte). */
export function tonLigne(l: LigneRegistre): string {
  if (l.type === "ecart" || l.type === "ecart_justifie") return "bg-amber-100 text-amber-700";
  if (l.type === "muet") return "bg-red-100 text-red-600";
  if (l.sorte === "note") return "bg-violet-100 text-violet-700";
  if (l.sorte === "item") return "bg-lime-100 text-lime-800";
  if (l.sorte === "capteur") return "bg-blue-100 text-blue-700";
  if (l.sorte === "fiche") return "bg-chanv-fibre text-chanv-terre";
  if (l.sorte === "export") return "bg-slate-100 text-slate-600";
  if (l.type === "probleme_signale" || l.type === "actif_hors_service") return "bg-red-100 text-red-700";
  if (l.type === "intervention_annulee" || l.type === "intervention_refusee") return "bg-slate-100 text-slate-600";
  if (l.type === "intervention_validee" || l.type === "actif_remis_en_service") return "bg-emerald-100 text-emerald-700";
  if (l.sorte === "entretien") return "bg-orange-100 text-orange-700";
  return "bg-green-100 text-green-700";
}

export function Encart({ titre, valeur, sous }: { titre: string; valeur: React.ReactNode; sous?: React.ReactNode }) {
  return (
    <div className="section-card p-4 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{titre}</div>
      <div className="text-lg font-bold text-chanv-terre mt-0.5">{valeur}</div>
      {sous && <div className="text-[11px] text-slate-500 mt-0.5">{sous}</div>}
    </div>
  );
}
