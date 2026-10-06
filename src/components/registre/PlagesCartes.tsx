"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Droplets, Loader2, Target } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { duree, plageTexte, type Formats } from "@/lib/registre/libelles";
import type { PlagesSalle } from "@/lib/registre/types";
import { Champ, CLASSE_CHAMP, Fenetre } from "./Fenetre";

// ============================================================
// Plage cible sur la fiche (V5) : température et humidité, minimum
// et maximum, saisies par un administrateur. Chaque changement
// s'inscrit au registre ; les écarts se recalculent sur le passé.
// ============================================================

interface Props {
  salleId: string;
  plages: PlagesSalle;
  /** Intervalle le plus court des capteurs de la salle (s), pour dire combien de temps fait un écart. */
  intervalleS: number | null;
  estAdmin: boolean;
}

export function PlagesCartes({ salleId, plages, intervalleS, estAdmin }: Props) {
  const t = useT();
  const locale = useLocale();
  const f: Formats = { t, locale };
  const [ouvert, setOuvert] = useState(false);
  const delai = intervalleS ? duree((plages.seuil * intervalleS) / 60, t) : null;
  const carte = (icone: React.ReactNode, libelle: string, valeur: string, sous?: string) => (
    <div className="section-card p-4 flex items-center gap-3 border-dashed">
      <div className="text-chanv-terre">{icone}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{libelle}</div>
        <div className="text-sm font-medium text-chanv-terre">{valeur}</div>
        {sous && <div className="text-[11px] text-slate-500">{sous}</div>}
      </div>
      {estAdmin && (
        <button onClick={() => setOuvert(true)} className="btn-ghost text-xs px-3 py-1.5">
          {t("plages.modifier")}
        </button>
      )}
    </div>
  );
  const tempDefinie = plages.tempMin != null || plages.tempMax != null;
  return (
    <>
      {carte(
        <Target className="w-4 h-4" />,
        t("plages.temperature"),
        plageTexte(plages.tempMin, plages.tempMax, "°C", f),
        tempDefinie
          ? delai
            ? t("plages.seuilAvecDuree", { n: plages.seuil, duree: delai })
            : t("plages.seuil", { n: plages.seuil })
          : t("plages.aucuneAide")
      )}
      {carte(<Droplets className="w-4 h-4" />, t("plages.humidite"), plageTexte(plages.humMin, plages.humMax, "%", f))}
      {ouvert && <ModifierPlages salleId={salleId} plages={plages} onClose={() => setOuvert(false)} />}
    </>
  );
}

function ModifierPlages({ salleId, plages, onClose }: { salleId: string; plages: PlagesSalle; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const texte = (v: number | null) => (v == null ? "" : String(v));
  const [v, setV] = useState({
    plageTempMin: texte(plages.tempMin),
    plageTempMax: texte(plages.tempMax),
    plageHumMin: texte(plages.humMin),
    plageHumMax: texte(plages.humMax),
    plageSeuil: String(plages.seuil),
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const nombre = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

  const envoyer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch(`/api/admin/locaux/${encodeURIComponent(salleId)}/plages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plageTempMin: nombre(v.plageTempMin),
          plageTempMax: nombre(v.plageTempMax),
          plageHumMin: nombre(v.plageHumMin),
          plageHumMax: nombre(v.plageHumMax),
          plageSeuil: nombre(v.plageSeuil) ?? 2,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      onClose();
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  };

  const champ = (k: keyof typeof v, libelle: string) => (
    <Champ libelle={libelle}>
      <input
        inputMode="decimal"
        value={v[k]}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
        className={CLASSE_CHAMP}
        placeholder="—"
      />
    </Champ>
  );

  return (
    <Fenetre
      titre={t("plages.titre")}
      onClose={onClose}
      pied={
        <>
          {erreur && (
            <span className="mr-auto flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" /> {erreur}
            </span>
          )}
          <button onClick={onClose} className="btn-ghost text-xs">{t("actifsSalle.annuler")}</button>
          <button onClick={envoyer} disabled={envoi} className="btn-primary text-xs">
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("plages.enregistrer")}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {champ("plageTempMin", t("plages.tempMin"))}
        {champ("plageTempMax", t("plages.tempMax"))}
        {champ("plageHumMin", t("plages.humMin"))}
        {champ("plageHumMax", t("plages.humMax"))}
      </div>
      <Champ libelle={t("plages.seuilLibelle")} aide={t("plages.seuilAide")}>
        <input inputMode="numeric" value={v.plageSeuil} onChange={(e) => setV({ ...v, plageSeuil: e.target.value })} className={CLASSE_CHAMP} />
      </Champ>
      <p className="text-[11px] text-slate-500">{t("plages.aide")}</p>
    </Fenetre>
  );
}
