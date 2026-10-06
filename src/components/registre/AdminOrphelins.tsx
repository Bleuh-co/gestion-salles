"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { Certitude } from "@/lib/registre/orphelins";
import { useJson } from "./commun";

// ============================================================
// Lot 0 — équipements rattachés à un code de salle qui n'existe pas
// (souvent le NOM de la salle, repris du Google Sheet). Une salle est
// proposée pour chaque code ; une personne qui connaît le bâtiment
// valide, groupe par groupe. Chaque correction s'inscrit au registre.
// ============================================================

interface Groupe {
  code: string;
  actifs: { id: string; matricule: string; nom: string; statut: string }[];
  salleId: string | null;
  certitude: Certitude;
}

interface Reponse {
  groupes: Groupe[];
  sansSalle: { id: string; matricule: string; nom: string }[];
  total: number;
}

const AUCUNE = "__aucune__";

const TON: Record<Certitude, string> = {
  meme_nom: "bg-green-100 text-green-700",
  probable: "bg-blue-100 text-blue-700",
  a_decider: "bg-amber-100 text-amber-700",
};

export function AdminOrphelins({ salles }: { salles: { id: string; nomSalle: string }[] }) {
  const t = useT();
  const { data, recharger } = useJson<Reponse>("/api/admin/orphelins");
  const [ouvert, setOuvert] = useState(true);
  if (!data || !data.groupes.length) return null;
  const n = data.groupes.reduce((s, g) => s + g.actifs.length, 0);

  return (
    <div className="section-card border-l-4 border-l-amber-400">
      <button onClick={() => setOuvert(!ouvert)} className="w-full flex items-center gap-2 p-4 text-left" aria-expanded={ouvert}>
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="flex-1 text-sm text-chanv-terre">
          <strong>{t("orphelins.titre")}</strong>{" "}
          {t("orphelins.resume", { n, codes: data.groupes.length, total: data.total, sansSalle: data.sansSalle.length })}
        </span>
        {ouvert ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {ouvert && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-slate-500">{t("orphelins.aide")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-chanv-fibre text-left">
                  {["colCode", "colActifs", "colSalle", "colCertitude", ""].map((k) => (
                    <th key={k || "x"} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {k ? t(`orphelins.${k}`) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.groupes.map((g) => (
                  <LigneGroupe key={g.code} g={g} salles={salles} onFait={recharger} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function LigneGroupe({ g, salles, onFait }: { g: Groupe; salles: { id: string; nomSalle: string }[]; onFait: () => void }) {
  const t = useT();
  const router = useRouter();
  const [choix, setChoix] = useState(g.salleId ?? "");
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const appliquer = async () => {
    if (!choix) return;
    const cible = choix === AUCUNE ? "" : choix;
    const nom = cible ? salles.find((s) => s.id === cible)?.nomSalle || cible : t("orphelins.aucuneSalle");
    if (!confirm(t("orphelins.confirmer", { n: g.actifs.length, code: g.code, salle: nom }))) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch("/api/admin/orphelins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: g.code, salleId: cible }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      onFait();
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <>
      <tr className="border-b border-chanv-fibre/50 align-top">
        <td className="px-2 py-2 font-mono text-xs text-chanv-terre">{g.code}</td>
        <td className="px-2 py-2 text-xs">
          <button onClick={() => setVoir(!voir)} className="text-chanv-terre underline decoration-dotted">
            {t("orphelins.nActifs", { n: g.actifs.length })}
          </button>
        </td>
        <td className="px-2 py-2">
          <select value={choix} onChange={(e) => setChoix(e.target.value)} className="text-xs border border-chanv-fibre rounded-lg px-2 py-1.5 bg-white max-w-[16rem]">
            <option value="">{t("orphelins.choisir")}</option>
            <option value={AUCUNE}>{t("orphelins.aucuneSalle")}</option>
            {salles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nomSalle ? `${s.nomSalle} (${s.id})` : s.id}
              </option>
            ))}
          </select>
          {erreur && <div className="text-[11px] text-red-600 mt-1">{erreur}</div>}
        </td>
        <td className="px-2 py-2">
          <span className={`badge text-[10px] ${TON[g.certitude]}`}>{t(`orphelins.certitude.${g.certitude}`)}</span>
        </td>
        <td className="px-2 py-2 text-right">
          <button onClick={appliquer} disabled={!choix || envoi} className="btn-primary text-[11px] px-3 py-1.5">
            {envoi && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("orphelins.appliquer")}
          </button>
        </td>
      </tr>
      {voir && (
        <tr className="border-b border-chanv-fibre/50">
          <td colSpan={5} className="px-2 pb-2 text-[11px] text-slate-600">
            {g.actifs.map((a) => `${a.matricule ? `${a.matricule} · ` : ""}${a.nom}`).join(" — ")}
          </td>
        </tr>
      )}
    </>
  );
}
