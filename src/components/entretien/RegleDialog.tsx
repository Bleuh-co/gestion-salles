"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { fenetreParDefaut } from "@/lib/entretien/calendrier";
import type { Frequence, ListesEntretien, PreuveExigee, Qui, Regle, UniteFrequence } from "@/lib/entretien/types";
import { Champ, CLASSE_CHAMP, Fenetre } from "@/components/registre/Fenetre";
import { ChoixPersonne, envoyer } from "./commun";

// ============================================================
// « Ajouter un entretien » (maquette V3) : une règle sur un ou
// plusieurs équipements (ou une salle), sa fréquence, sa prochaine
// échéance, qui fait, la preuve et la liste de contrôle. Sert aussi à
// modifier une règle et, pendant la séance de reprise, à corriger la
// règle proposée.
// ============================================================

export interface OptionsEntretien {
  actifs: { id: string; nom: string; matricule: string; idSalle: string; criticite: string; idMasterlist: string }[];
  salles: { id: string; nomSalle: string }[];
  listes: ListesEntretien;
}

let optionsCache: Promise<OptionsEntretien | null> | null = null;

export function useOptionsEntretien(): OptionsEntretien | null {
  const [o, setO] = useState<OptionsEntretien | null>(null);
  useEffect(() => {
    if (!optionsCache) {
      optionsCache = fetch("/api/entretien/options")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    }
    let vivant = true;
    optionsCache.then((x) => vivant && setO(x));
    return () => {
      vivant = false;
    };
  }, []);
  return o;
}

type TypeFreq = "periodique" | "saisonniere" | "ponctuelle" | "aucune";

interface Props {
  /** Règle à modifier, règle proposée (reprise) ou valeurs de départ. */
  initiale?: Partial<Regle>;
  mode: "creer" | "modifier" | "reprise";
  regleId?: string;
  repriseId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function RegleDialog({ initiale = {}, mode, regleId, repriseId, onClose, onSaved }: Props) {
  const t = useT();
  const options = useOptionsEntretien();
  const [actifIds, setActifIds] = useState<string[]>(initiale.actifIds ?? []);
  const [salleIds, setSalleIds] = useState<string[]>(initiale.salleIds ?? []);
  const [equipementLibre, setEquipementLibre] = useState(initiale.equipementLibre ?? "");
  const [type, setType] = useState(initiale.type ?? "Préventif (Planifié)");
  const [criticite, setCriticite] = useState(initiale.criticite ?? "");
  const [titre, setTitre] = useState(initiale.titre ?? "");
  const [consigne, setConsigne] = useState(initiale.consigne ?? "");
  const [procedureUrl, setProcedureUrl] = useState(initiale.procedureUrl ?? "");
  const f0 = initiale.frequence ?? null;
  const [typeFreq, setTypeFreq] = useState<TypeFreq>(f0 ? f0.type : "aucune");
  const [n, setN] = useState(f0?.type === "periodique" ? f0.n : 1);
  const [unite, setUnite] = useState<UniteFrequence>(f0?.type === "periodique" ? f0.unite : "an");
  const [mois, setMois] = useState<number[]>(f0?.type === "saisonniere" ? f0.mois : [7, 8]);
  const [prochaine, setProchaine] = useState(initiale.prochaine ?? "");
  const [calcul, setCalcul] = useState(initiale.calcul ?? "prevue");
  const [fenetre, setFenetre] = useState(initiale.fenetreJours != null ? String(initiale.fenetreJours) : "");
  const q0 = initiale.qui ?? null;
  const [typeQui, setTypeQui] = useState<Qui["type"] | "">(q0?.type ?? "");
  const [email, setEmail] = useState(q0?.type === "personne" ? q0.email : "");
  const [metier, setMetier] = useState(q0?.type === "metier" ? q0.metier : "");
  const [fournisseur, setFournisseur] = useState(q0?.type === "soustraitant" ? q0.fournisseur : "");
  const [repondant, setRepondant] = useState(q0?.type === "soustraitant" ? q0.repondant : "");
  const [preuve, setPreuve] = useState<PreuveExigee>(initiale.preuve ?? "photo");
  const [mesureUnite, setMesureUnite] = useState(initiale.mesureUnite ?? "");
  const [checklist, setChecklist] = useState<string[]>(initiale.checklist?.length ? initiale.checklist : []);
  const [etape, setEtape] = useState("");
  const [recherche, setRecherche] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const frequence: Frequence | null =
    typeFreq === "periodique"
      ? { type: "periodique", n: Math.max(1, Math.round(n) || 1), unite }
      : typeFreq === "saisonniere"
        ? { type: "saisonniere", mois }
        : typeFreq === "ponctuelle"
          ? { type: "ponctuelle" }
          : null;
  const qui: Qui | null =
    typeQui === "personne" && email
      ? { type: "personne", email }
      : typeQui === "metier" && metier
        ? { type: "metier", metier }
        : typeQui === "soustraitant"
          ? { type: "soustraitant", fournisseur, repondant }
          : null;

  const actifsChoisis = useMemo(
    () => actifIds.map((id) => options?.actifs.find((a) => a.id === id) ?? { id, nom: id, matricule: "", idSalle: "", criticite: "", idMasterlist: "" }),
    [actifIds, options]
  );
  const salleDe = (id: string) => options?.salles.find((s) => s.id === id);
  const trouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q || !options) return [];
    return options.actifs
      .filter((a) => !actifIds.includes(a.id))
      .filter((a) => `${a.nom} ${a.matricule} ${a.idMasterlist} ${a.idSalle}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [recherche, options, actifIds]);

  // Criticité reprise de l'équipement quand elle n'est pas choisie.
  useEffect(() => {
    if (criticite || !actifsChoisis.length) return;
    const c = actifsChoisis.find((a) => a.criticite)?.criticite;
    if (c) {
      const l = options?.listes.criticites.find((x) => x.toLowerCase().startsWith(c.toLowerCase()));
      if (l) setCriticite(l);
    }
  }, [actifsChoisis, criticite, options]);

  const enregistrer = async () => {
    setErreur(null);
    const regle = {
      titre,
      type,
      consigne,
      procedureUrl,
      actifIds,
      salleIds: actifIds.length ? [] : salleIds,
      equipementLibre,
      frequence,
      prochaine: prochaine || null,
      calcul,
      fenetreJours: fenetre === "" ? null : Number(fenetre),
      qui,
      checklist: [...checklist, etape.trim()].filter(Boolean),
      preuve,
      mesureUnite,
      criticite,
      remarque: initiale.remarque ?? "",
    };
    setEnvoi(true);
    const r =
      mode === "reprise" && repriseId
        ? await envoyer(`/api/entretien/reprise/${encodeURIComponent(repriseId)}`, "PATCH", { regle, decision: "garder" })
        : mode === "modifier" && regleId
          ? await envoyer(`/api/entretien/regles/${encodeURIComponent(regleId)}`, "PATCH", regle)
          : await envoyer("/api/entretien/regles", "POST", regle);
    setEnvoi(false);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    onSaved();
  };

  const listes = options?.listes;
  const fenetreDefaut = fenetreParDefaut(frequence);
  const titreFenetre = mode === "modifier" ? t("regle.modifierTitre") : mode === "reprise" ? t("regle.repriseTitre") : t("regle.ajouterTitre");

  return (
    <Fenetre
      titre={titreFenetre}
      sousTitre={t("regle.sousTitre")}
      onClose={onClose}
      large
      pied={
        <>
          {erreur && <span className="text-xs text-red-600 mr-auto">{erreur}</span>}
          <button onClick={onClose} className="btn-ghost text-sm">{t("entretien.annuler")}</button>
          <button onClick={enregistrer} disabled={envoi || !titre.trim()} className="btn-primary text-sm">
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "reprise" ? t("regle.garder") : t("entretien.enregistrer")}
          </button>
        </>
      }
    >
      {!options ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-chanv-terre" /></div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Champ libelle={t("regle.equipements")} aide={t("regle.equipementsAide")}>
              <div className="space-y-1.5">
                {actifsChoisis.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm bg-chanv-fibre/40 rounded-lg px-2 py-1">
                    <span className="flex-1 min-w-0 truncate">{a.nom} <span className="text-[11px] text-slate-400">{a.matricule}</span></span>
                    <button type="button" onClick={() => setActifIds(actifIds.filter((x) => x !== a.id))} className="text-slate-400 hover:text-red-600" aria-label={t("regle.retirer")}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t("regle.chercherEquipement")} className={CLASSE_CHAMP} />
                {trouves.length > 0 && (
                  <div className="border border-chanv-fibre rounded-lg divide-y divide-chanv-fibre/60 max-h-48 overflow-y-auto">
                    {trouves.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setActifIds([...actifIds, a.id]);
                          setRecherche("");
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-chanv-fibre/50"
                      >
                        {a.nom} <span className="text-[11px] text-slate-400">{a.matricule} · {salleDe(a.idSalle)?.nomSalle || a.idSalle || t("regle.sansSalle")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Champ>
            <Champ libelle={t("regle.salle")}>
              {actifIds.length ? (
                <div className="text-sm text-chanv-terre py-2">
                  {[...new Set(actifsChoisis.map((a) => a.idSalle))].map((id) =>
                    salleDe(id) ? (
                      <div key={id}>{salleDe(id)!.nomSalle} <span className="text-[11px] text-slate-400">{id}</span></div>
                    ) : (
                      <div key={id || "aucune"} className="text-red-600">{id ? t("regle.salleInconnue", { code: id }) : t("regle.sansSalle")}</div>
                    )
                  )}
                </div>
              ) : (
                <>
                  <select
                    value={salleIds[0] ?? ""}
                    onChange={(e) => setSalleIds(e.target.value ? [e.target.value] : [])}
                    className={CLASSE_CHAMP}
                  >
                    <option value="">{t("regle.choisirSalle")}</option>
                    {options.salles.map((s) => (
                      <option key={s.id} value={s.id}>{s.nomSalle ? `${s.nomSalle} (${s.id})` : s.id}</option>
                    ))}
                  </select>
                  <input value={equipementLibre} onChange={(e) => setEquipementLibre(e.target.value)} placeholder={t("regle.equipementLibre")} className={`${CLASSE_CHAMP} mt-2`} />
                </>
              )}
            </Champ>
            <Champ libelle={t("regle.type")}>
              <select value={type} onChange={(e) => setType(e.target.value)} className={CLASSE_CHAMP}>
                {[...new Set([type, ...(listes?.types ?? [])])].filter(Boolean).map((x) => <option key={x}>{x}</option>)}
              </select>
            </Champ>
            <Champ libelle={t("regle.criticite")}>
              <select value={criticite} onChange={(e) => setCriticite(e.target.value)} className={CLASSE_CHAMP}>
                <option value="">—</option>
                {[...new Set([criticite, ...(listes?.criticites ?? [])])].filter(Boolean).map((x) => <option key={x}>{x}</option>)}
              </select>
            </Champ>
          </div>
          <Champ libelle={t("regle.titre")}>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className={CLASSE_CHAMP} maxLength={140} />
          </Champ>
          <Champ libelle={t("regle.consigne")}>
            <textarea value={consigne} onChange={(e) => setConsigne(e.target.value)} className={CLASSE_CHAMP} rows={2} maxLength={2000} />
          </Champ>
          <Champ libelle={t("regle.procedure")}>
            <input value={procedureUrl} onChange={(e) => setProcedureUrl(e.target.value)} placeholder="https://…" className={CLASSE_CHAMP} />
          </Champ>
          <div className="grid sm:grid-cols-2 gap-4">
            <Champ libelle={t("regle.frequence")}>
              <div className="space-y-2">
                <select value={typeFreq} onChange={(e) => setTypeFreq(e.target.value as TypeFreq)} className={CLASSE_CHAMP}>
                  <option value="aucune">{t("regle.freqAucune")}</option>
                  <option value="periodique">{t("regle.freqPeriodique")}</option>
                  <option value="saisonniere">{t("regle.freqSaison")}</option>
                  <option value="ponctuelle">{t("regle.freqPonctuelle")}</option>
                </select>
                {typeFreq === "periodique" && (
                  <div className="flex items-center gap-2 text-sm">
                    <span>{t("regle.tousLes")}</span>
                    <input type="number" min={1} max={100} value={n} onChange={(e) => setN(Number(e.target.value))} className={`${CLASSE_CHAMP} w-20`} />
                    <select value={unite} onChange={(e) => setUnite(e.target.value as UniteFrequence)} className={CLASSE_CHAMP}>
                      {(["jour", "semaine", "mois", "an"] as const).map((u) => <option key={u} value={u}>{t(`regle.unite.${u}`)}</option>)}
                    </select>
                  </div>
                )}
                {typeFreq === "saisonniere" && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMois(mois.includes(m) ? mois.filter((x) => x !== m) : [...mois, m].sort((a, b) => a - b))}
                        className={`px-2 py-1 rounded-lg text-xs border ${mois.includes(m) ? "bg-chanv-terre text-white border-chanv-terre" : "border-chanv-fibre"}`}
                      >
                        {t(`mois.${m}`)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Champ>
            <Champ libelle={t("regle.prochaine")} aide={typeFreq === "saisonniere" ? t("regle.prochaineSaison") : undefined}>
              <input type="date" value={prochaine} onChange={(e) => setProchaine(e.target.value)} className={CLASSE_CHAMP} />
            </Champ>
            <Champ libelle={t("regle.calcul")} aide={t("regle.calculAide")}>
              <div className="flex flex-col gap-1 text-sm py-1">
                <label className="flex items-center gap-2"><input type="radio" checked={calcul === "prevue"} onChange={() => setCalcul("prevue")} /> {t("regle.calculPrevue")}</label>
                <label className="flex items-center gap-2"><input type="radio" checked={calcul === "faite"} onChange={() => setCalcul("faite")} /> {t("regle.calculFaite")}</label>
              </div>
            </Champ>
            <Champ libelle={t("regle.fenetre")} aide={t("regle.fenetreAide", { n: fenetreDefaut })}>
              <input type="number" min={0} max={365} value={fenetre} placeholder={String(fenetreDefaut)} onChange={(e) => setFenetre(e.target.value)} className={CLASSE_CHAMP} />
            </Champ>
            <Champ libelle={t("regle.qui")}>
              <div className="space-y-2">
                <select value={typeQui} onChange={(e) => setTypeQui(e.target.value as Qui["type"] | "")} className={CLASSE_CHAMP}>
                  <option value="">{t("regle.quiAChoisir")}</option>
                  <option value="metier">{t("regle.quiMetier")}</option>
                  <option value="personne">{t("regle.quiPersonne")}</option>
                  <option value="soustraitant">{t("regle.quiSousTraitant")}</option>
                </select>
                {typeQui === "personne" && <ChoixPersonne valeur={email} onChange={setEmail} placeholder={t("regle.chercherPersonne")} />}
                {typeQui === "metier" && (
                  <select value={metier} onChange={(e) => setMetier(e.target.value)} className={CLASSE_CHAMP}>
                    <option value="">—</option>
                    {[...new Set([metier, ...(listes?.metiers ?? [])])].filter(Boolean).map((x) => <option key={x}>{x}</option>)}
                  </select>
                )}
                {typeQui === "soustraitant" && (
                  <>
                    <input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} placeholder={t("regle.fournisseur")} className={CLASSE_CHAMP} />
                    <ChoixPersonne valeur={repondant} onChange={setRepondant} placeholder={t("regle.repondant")} id="repondants-entretien" />
                  </>
                )}
              </div>
            </Champ>
            <Champ libelle={t("regle.preuve")}>
              <div className="space-y-2">
                <select value={preuve} onChange={(e) => setPreuve(e.target.value as PreuveExigee)} className={CLASSE_CHAMP}>
                  {(["photo", "rapport", "mesure", "aucune"] as const).map((p) => <option key={p} value={p}>{t(`regle.preuve.${p}`)}</option>)}
                </select>
                {preuve === "mesure" && <input value={mesureUnite} onChange={(e) => setMesureUnite(e.target.value)} placeholder={t("regle.mesureUnite")} className={CLASSE_CHAMP} />}
              </div>
            </Champ>
          </div>
          <Champ libelle={t("regle.checklist")} aide={t("regle.checklistAide")}>
            <div className="space-y-1.5">
              {checklist.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs w-5 text-right">{i + 1}.</span>
                  <input value={c} onChange={(e) => setChecklist(checklist.map((x, j) => (j === i ? e.target.value : x)))} className={CLASSE_CHAMP} />
                  <button type="button" onClick={() => setChecklist(checklist.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" aria-label={t("regle.retirer")}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={etape}
                  onChange={(e) => setEtape(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && etape.trim()) {
                      e.preventDefault();
                      setChecklist([...checklist, etape.trim()]);
                      setEtape("");
                    }
                  }}
                  placeholder={t("regle.ajouterEtape")}
                  className={CLASSE_CHAMP}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (etape.trim()) setChecklist([...checklist, etape.trim()]);
                    setEtape("");
                  }}
                  className="btn-ghost border border-chanv-fibre text-xs"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Champ>
          {!frequence || !prochaine || !qui ? (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t("regle.aCompleterAide")}</p>
          ) : null}
        </>
      )}
    </Fenetre>
  );
}
