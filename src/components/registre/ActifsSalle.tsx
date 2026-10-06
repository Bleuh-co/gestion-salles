"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeftRight, History, Loader2, MoreHorizontal, PackageMinus, Plus } from "lucide-react";
import type { Actif } from "@/lib/types";
import { useLocale, useT } from "@/lib/i18n";
import { dateCourte } from "@/lib/registre/libelles";
import { jourDe } from "@/lib/registre/temps";
import { MOTIFS_AJOUT, MOTIFS_DEPLACEMENT, MOTIFS_RETRAIT } from "@/lib/registre/actifs";
import { EmptyState } from "@/components/EmptyState";
import { ActifFormModal } from "@/components/ActifFormModal";
import { Champ, CLASSE_CHAMP, Fenetre } from "./Fenetre";

// ============================================================
// Onglet « Actifs » d'une salle (V4) : les actifs présents, depuis
// quand, et les gestes qui alimentent le registre — déplacer vers
// une autre salle, retirer de la salle, ajouter un actif — avec une
// date et un motif. Réservés aux administrateurs (plan, D3).
// ============================================================

export interface ActifLigne {
  actif: Actif;
  depuis: number | null;
  origine: "installation" | "ouverture" | "mouvement" | "correction";
  /** L'actif est dans une autre salle et dessert celle-ci. */
  dessert: boolean;
}

interface Props {
  salleId: string;
  lignes: ActifLigne[];
  estAdmin: boolean;
  salles: { id: string; nomSalle: string }[];
  /** Tous les actifs (administrateurs seulement : « Ajouter un actif »). */
  tousActifs: Actif[] | null;
  onHistorique: (a: Actif) => void;
}

type Geste = { type: "deplacer" | "retirer"; actif: Actif } | { type: "ajouter" } | { type: "creer" } | null;

const CRITICITE: Record<string, string> = {
  Critique: "bg-red-100 text-red-700",
  Majeur: "bg-amber-100 text-amber-700",
  Mineur: "bg-blue-100 text-blue-700",
};

export function ActifsSalle({ salleId, lignes, estAdmin, salles, tousActifs, onHistorique }: Props) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  // Menu d'une ligne, posé au-dessus de la page (le tableau défile et le couperait).
  const [menu, setMenu] = useState<{ actif: Actif; dessert: boolean; x: number; y: number } | null>(null);
  const [geste, setGeste] = useState<Geste>(null);
  useEffect(() => {
    if (!menu) return;
    const fermer = () => setMenu(null);
    window.addEventListener("scroll", fermer, true);
    window.addEventListener("resize", fermer);
    return () => {
      window.removeEventListener("scroll", fermer, true);
      window.removeEventListener("resize", fermer);
    };
  }, [menu]);
  const nomSalle = (id: string) => {
    const s = salles.find((x) => x.id === id);
    return s?.nomSalle ? `${id} · ${s.nomSalle}` : id;
  };

  const options = useMemo(() => {
    const tous = tousActifs ?? [];
    const uniq = (v: string[]) => [...new Set(v.map((x) => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    return {
      categories: uniq(tous.map((a) => a.categorie)),
      criticites: uniq([...tous.map((a) => a.criticite), "Critique", "Majeur", "Mineur"]),
      statuts: uniq(tous.map((a) => a.statut)),
    };
  }, [tousActifs]);

  return (
    <div className="space-y-3">
      {estAdmin && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setGeste({ type: "ajouter" })} className="btn-ghost border border-chanv-fibre text-xs">
            <Plus className="w-4 h-4" />
            {t("actifsSalle.ajouter")}
          </button>
          <button onClick={() => setGeste({ type: "creer" })} className="btn-ghost text-xs text-slate-500">
            {t("actifsSalle.creer")}
          </button>
        </div>
      )}

      {lignes.length === 0 ? (
        <EmptyState icon="🔧" title={t("actifs.emptyTitle")} description={t("actifs.emptyDescription")} />
      ) : (
        <div className="section-card overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-chanv-fibre text-left">
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("actifs.colAsset")}</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("actifs.colCategory")}</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("actifs.colBrandModel")}</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("actifs.colCriticality")}</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("actifs.colStatus")}</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{t("actifsSalle.colDepuis")}</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {lignes.map(({ actif: a, depuis, origine, dessert }) => (
                  <tr key={a.id} className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-chanv-terre">{a.nom}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{a.matricule}</div>
                      {dessert && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{t("actifsSalle.dessert", { salle: nomSalle(a.idSalle) || "—" })}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.categorie || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.marque || a.modele ? `${a.marque}${a.modele ? ` ${a.modele}` : ""}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.criticite ? <span className={`badge text-xs ${CRITICITE[a.criticite] || "bg-slate-100 text-slate-600"}`}>{a.criticite}</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge text-xs ${
                          a.statut === "En Construction" ? "bg-amber-100 text-amber-700" : a.statut === "En Attente" ? "bg-slate-100 text-slate-600" : "bg-green-100 text-green-700"
                        }`}
                      >
                        {a.statut || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {dessert || depuis == null ? "—" : (
                        <>
                          {dateCourte(depuis, locale)} <span className="text-slate-400">({t(`actifsSalle.origine.${origine}`)})</span>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        onClick={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenu(menu?.actif.id === a.id ? null : { actif: a, dessert, x: r.right, y: r.bottom });
                        }}
                        className="p-1.5 text-slate-400 hover:text-chanv-terre hover:bg-chanv-fibre/50 rounded-lg"
                        aria-label={t("actifsSalle.menu")}
                        aria-expanded={menu?.actif.id === a.id}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {menu &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
            <div
              className="fixed z-50 w-60 card p-1.5 text-sm"
              style={{ top: Math.min(menu.y + 4, window.innerHeight - 150), left: Math.max(8, menu.x - 240) }}
              role="menu"
            >
              {estAdmin && !menu.dessert && (
                <>
                  <button role="menuitem" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-chanv-fibre/50 text-left" onClick={() => { setGeste({ type: "deplacer", actif: menu.actif }); setMenu(null); }}>
                    <ArrowLeftRight className="w-4 h-4" /> {t("actifsSalle.deplacer")}
                  </button>
                  <button role="menuitem" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-chanv-fibre/50 text-left" onClick={() => { setGeste({ type: "retirer", actif: menu.actif }); setMenu(null); }}>
                    <PackageMinus className="w-4 h-4" /> {t("actifsSalle.retirer")}
                  </button>
                </>
              )}
              <button role="menuitem" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-chanv-fibre/50 text-left" onClick={() => { onHistorique(menu.actif); setMenu(null); }}>
                <History className="w-4 h-4" /> {t("actifsSalle.historique")}
              </button>
            </div>
          </>,
          document.body
        )}

      {geste && geste.type !== "creer" && (
        <GesteActif
          geste={geste}
          salleId={salleId}
          salles={salles}
          tousActifs={tousActifs ?? []}
          nomSalle={nomSalle}
          onClose={() => setGeste(null)}
          onFait={() => {
            setGeste(null);
            router.refresh();
          }}
        />
      )}
      {geste?.type === "creer" && (
        <ActifFormModal
          actif={null}
          salleInitiale={salleId}
          salles={salles}
          options={options}
          onClose={() => setGeste(null)}
          onSaved={() => {
            setGeste(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function GesteActif({
  geste,
  salleId,
  salles,
  tousActifs,
  nomSalle,
  onClose,
  onFait,
}: {
  geste: Exclude<Geste, null | { type: "creer" }>;
  salleId: string;
  salles: { id: string; nomSalle: string }[];
  tousActifs: Actif[];
  nomSalle: (id: string) => string;
  onClose: () => void;
  onFait: () => void;
}) {
  const t = useT();
  const aujourdHui = jourDe(Date.now());
  const [jour, setJour] = useState(aujourdHui);
  const [motif, setMotif] = useState<string>(geste.type === "retirer" ? "reforme" : geste.type === "ajouter" ? "installation" : "reaffectation");
  const [note, setNote] = useState("");
  const [vers, setVers] = useState("");
  const [choisi, setChoisi] = useState("");
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const idsSalles = useMemo(() => new Set(salles.map((s) => s.id)), [salles]);

  const candidats = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return tousActifs
      .filter((a) => a.idSalle !== salleId)
      .filter((a) => !q || a.nom.toLowerCase().includes(q) || a.matricule.toLowerCase().includes(q) || a.idSalle.toLowerCase().includes(q))
      .slice(0, 200);
  }, [tousActifs, salleId, recherche]);

  const actif = geste.type === "ajouter" ? tousActifs.find((a) => a.id === choisi) ?? null : geste.actif;
  const motifs = geste.type === "retirer" ? MOTIFS_RETRAIT : geste.type === "ajouter" ? MOTIFS_AJOUT : MOTIFS_DEPLACEMENT;
  const pret = !envoi && !!actif && (geste.type !== "deplacer" || !!vers) && !!jour && jour <= aujourdHui;

  const envoyer = async () => {
    if (!actif || !pret) return;
    setEnvoi(true);
    setErreur(null);
    const action =
      geste.type === "retirer" ? "retirer" : geste.type === "deplacer" ? "deplacer" : actif.idSalle && idsSalles.has(actif.idSalle) ? "deplacer" : "placer";
    try {
      const res = await fetch(`/api/admin/actifs/${encodeURIComponent(actif.id)}/mouvement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, vers: geste.type === "ajouter" ? salleId : vers, jour, motif, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      onFait();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
      setEnvoi(false);
    }
  };

  const titre = t(geste.type === "deplacer" ? "actifsSalle.titreDeplacer" : geste.type === "retirer" ? "actifsSalle.titreRetirer" : "actifsSalle.titreAjouter");
  const deuxSalles = geste.type === "deplacer" || (geste.type === "ajouter" && actif && idsSalles.has(actif.idSalle));

  return (
    <Fenetre
      titre={titre}
      sousTitre={actif ? `${actif.matricule ? `${actif.matricule} · ` : ""}${actif.nom}` : undefined}
      onClose={onClose}
      pied={
        <>
          {erreur && (
            <span className="mr-auto flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" /> {erreur}
            </span>
          )}
          <button onClick={onClose} className="btn-ghost text-xs">{t("actifsSalle.annuler")}</button>
          <button onClick={envoyer} disabled={!pret} className="btn-primary text-xs">
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
            {titre}
          </button>
        </>
      }
    >
      {geste.type === "ajouter" && (
        <Champ libelle={t("actifsSalle.actif")} aide={t("actifsSalle.aideAjouter")}>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("actifsSalle.rechercher")}
            className={`${CLASSE_CHAMP} mb-2`}
          />
          <select value={choisi} onChange={(e) => setChoisi(e.target.value)} className={CLASSE_CHAMP} size={6}>
            {candidats.map((a) => (
              <option key={a.id} value={a.id}>
                {a.matricule ? `${a.matricule} · ` : ""}
                {a.nom} — {a.idSalle ? (idsSalles.has(a.idSalle) ? a.idSalle : t("actifsSalle.codeInconnu", { code: a.idSalle })) : t("actifsSalle.sansSalle")}
              </option>
            ))}
          </select>
        </Champ>
      )}
      {geste.type !== "ajouter" && (
        <Champ libelle={t("actifsSalle.de")}>
          <div className="text-sm text-chanv-terre">{nomSalle(salleId)}</div>
        </Champ>
      )}
      {geste.type === "deplacer" && (
        <Champ libelle={t("actifsSalle.vers")}>
          <select value={vers} onChange={(e) => setVers(e.target.value)} className={CLASSE_CHAMP}>
            <option value="">{t("actifsSalle.choisirSalle")}</option>
            {salles
              .filter((s) => s.id !== salleId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nomSalle ? `${s.nomSalle} (${s.id})` : s.id}
                </option>
              ))}
          </select>
        </Champ>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Champ libelle={t(geste.type === "retirer" ? "actifsSalle.dateRetrait" : geste.type === "ajouter" ? "actifsSalle.dateArrivee" : "actifsSalle.dateDeplacement")}>
          <input type="date" value={jour} max={aujourdHui} onChange={(e) => setJour(e.target.value)} className={CLASSE_CHAMP} />
        </Champ>
        <Champ libelle={t("actifsSalle.motif")}>
          <select value={motif} onChange={(e) => setMotif(e.target.value)} className={CLASSE_CHAMP}>
            {motifs.map((m) => (
              <option key={m} value={m}>
                {t(`motif.${m}`)}
              </option>
            ))}
          </select>
        </Champ>
      </div>
      <Champ libelle={t("actifsSalle.note")}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={CLASSE_CHAMP} />
      </Champ>
      <p className="text-[11px] text-slate-500">
        {t(deuxSalles ? "actifsSalle.inscritDeuxSalles" : "actifsSalle.inscritUneSalle")}
      </p>
    </Fenetre>
  );
}
