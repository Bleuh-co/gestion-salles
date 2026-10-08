"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, Pencil, Plus } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { useJson } from "@/components/registre/commun";
import type { ConfigEntretien, LigneReprise, Regle } from "@/lib/entretien/types";
import { BadgeRetard, BadgeStatut, ChoixPersonne, envoyer, jourCourt, useFrequence, usePersonnes, type InterventionVue, type LigneCalendrier } from "./commun";
import { RegleDialog } from "./RegleDialog";
import { SignalerForm } from "./SignalerForm";

// ============================================================
// Section « Entretien » : calendrier (V7), file des interventions
// (V8), règles, équipe et listes, séance de reprise de la GMAO (V11).
// Gestionnaires et administrateurs ; l'équipe et la reprise se
// règlent par un administrateur.
// ============================================================

type Vue = "calendrier" | "interventions" | "regles" | "equipe" | "reprise";

export function EntretienClient({ admin, gestionnaire }: { admin: boolean; gestionnaire: boolean }) {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const vueInitiale = (params.get("vue") as Vue) || (gestionnaire ? "interventions" : "interventions");
  const [vue, setVue] = useState<Vue>(vueInitiale);
  const onglets: Vue[] = gestionnaire ? ["calendrier", "interventions", "regles", "equipe", ...(admin ? (["reprise"] as Vue[]) : [])] : ["interventions"];

  const choisir = (v: Vue) => {
    setVue(v);
    const q = new URLSearchParams(params.toString());
    q.set("vue", v);
    router.replace(`/entretien?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-5 pt-6">
      <div>
        <h1 className="text-xl font-bold text-chanv-terre">{t("nav.entretien")}</h1>
        <p className="text-sm text-slate-500">{t("entretien.sousTitre")}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {onglets.map((v) => (
          <button
            key={v}
            onClick={() => choisir(v)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border ${vue === v ? "bg-chanv-terre text-white border-chanv-terre" : "border-chanv-fibre bg-white text-slate-600"}`}
          >
            {t(`entretien.onglet.${v}`)}
          </button>
        ))}
      </div>
      {vue === "calendrier" && gestionnaire && <Calendrier />}
      {vue === "interventions" && <File gestionnaire={gestionnaire} filtreInitial={params.get("filtre") || ""} />}
      {vue === "regles" && gestionnaire && <Regles regleId={params.get("regle")} />}
      {vue === "equipe" && gestionnaire && <Equipe admin={admin} />}
      {vue === "reprise" && admin && <Reprise />}
    </div>
  );
}

// ── V7 : calendrier sur 12 mois ──

function Calendrier() {
  const t = useT();
  const locale = useLocale();
  const freq = useFrequence();
  const { data, erreur } = useJson<{ lignes: LigneCalendrier[]; jour: string; fin: string }>("/api/entretien/calendrier");
  const [salle, setSalle] = useState("");
  const mois = useMemo(() => {
    if (!data) return [];
    const [y, m] = data.jour.split("-").map(Number);
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(y, m - 1 + i, 1));
      return { cle: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, nom: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(d) };
    });
  }, [data, locale]);
  if (erreur) return <p className="text-sm text-red-600">{erreur}</p>;
  if (!data) return <Chargement />;
  const lignes = data.lignes.filter((l) => !salle || l.regle.salles.includes(salle));
  const salles = [...new Set(data.lignes.flatMap((l) => l.regle.salles))].sort();
  const passees = lignes.reduce((s, l) => s + l.passees, 0);
  const aVenir = lignes.reduce((s, l) => s + l.echeances.length, 0);
  const sansDate = lignes.filter((l) => !l.regle.prochaine || !l.regle.frequence).length;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Encart titre={t("calendrier.passees")} valeur={String(passees)} rouge={passees > 0} />
        <Encart titre={t("calendrier.aVenir")} valeur={String(aVenir)} />
        <Encart titre={t("calendrier.sansDate")} valeur={String(sansDate)} />
        <Encart titre={t("calendrier.regles")} valeur={String(lignes.length)} />
      </div>
      <select value={salle} onChange={(e) => setSalle(e.target.value)} className="text-xs border border-chanv-fibre rounded-lg px-2 py-1.5 bg-white">
        <option value="">{t("calendrier.toutesSalles")}</option>
        {salles.map((s) => <option key={s}>{s}</option>)}
      </select>
      {lignes.length === 0 ? (
        <p className="text-sm text-slate-500">{t("calendrier.vide")}</p>
      ) : (
        <div className="section-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-chanv-fibre text-left text-[10px] uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2 min-w-[220px]">{t("calendrier.entretien")}</th>
                <th className="px-2 py-2 text-center">{t("calendrier.passeesCourt")}</th>
                {mois.map((m) => <th key={m.cle} className="px-1.5 py-2 text-center">{m.nom}</th>)}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.regle.id} className="border-b border-chanv-fibre/50">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-chanv-terre">{l.regle.titre}</div>
                    <div className="text-[10px] text-slate-500">{[l.regle.equipements || l.regle.salles.join(", "), freq(l.regle.frequence)].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className={`px-2 py-2 text-center font-bold ${l.passees ? "text-red-700" : "text-slate-300"}`}>{l.passees || "—"}</td>
                  {mois.map((m) => {
                    const n = l.echeances.filter((e) => e.startsWith(m.cle));
                    return (
                      <td key={m.cle} className="px-1.5 py-2 text-center" title={n.map((e) => jourCourt(e, locale)).join(", ")}>
                        {n.length ? <span className="text-chanv-terre">{"●".repeat(Math.min(n.length, 3))}</span> : <span className="text-slate-200">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── V8 : la file des interventions ──

type FiltreFile = "a_assigner" | "retard" | "en_cours" | "en_attente" | "a_valider" | "miennes" | "toutes";

function File({ gestionnaire, filtreInitial }: { gestionnaire: boolean; filtreInitial: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { data, erreur, recharger } = useJson<{ interventions: InterventionVue[]; jour: string; moi: string }>("/api/entretien/interventions");
  const filtres: FiltreFile[] = gestionnaire ? ["a_assigner", "retard", "en_cours", "en_attente", "a_valider", "miennes", "toutes"] : ["miennes", "toutes"];
  const [filtre, setFiltre] = useState<FiltreFile>((filtres as string[]).includes(filtreInitial) ? (filtreInitial as FiltreFile) : gestionnaire ? "a_assigner" : "miennes");
  const [signaler, setSignaler] = useState(false);
  if (erreur) return <p className="text-sm text-red-600">{erreur}</p>;
  if (!data) return <Chargement />;
  const ouvertes = data.interventions.filter((iv) => !["validee", "annulee"].includes(iv.statut));
  const test = (iv: InterventionVue, f: FiltreFile) => {
    if (f === "toutes") return true;
    if (f === "miennes") return iv.assignes.includes(data.moi) || iv.signalePar?.email === data.moi;
    if (f === "retard") return (iv.retard ?? 0) > 0 && iv.statut !== "a_valider" && !["validee", "annulee"].includes(iv.statut);
    if (f === "en_cours") return iv.statut === "en_cours" || iv.statut === "a_faire";
    return iv.statut === f;
  };
  const liste = (filtre === "toutes" ? data.interventions : ouvertes.filter((iv) => test(iv, filtre)).concat(filtre === "miennes" ? [] : [])).sort((a, b) => {
    if (a.genre !== b.genre) return a.genre === "probleme" ? -1 : 1;
    return (b.retard ?? -9999) - (a.retard ?? -9999);
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {filtres.map((f) => (
          <button key={f} onClick={() => setFiltre(f)} className={`px-3 py-1 rounded-full text-xs border ${filtre === f ? "bg-chanv-fibre border-chanv-beige font-semibold text-chanv-terre" : "border-chanv-fibre bg-white text-slate-600"}`}>
            {t(`file.filtre.${f}`)} {f === "toutes" ? data.interventions.length : ouvertes.filter((iv) => test(iv, f)).length}
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={() => setSignaler(true)} className="btn-ghost text-xs border border-red-200 bg-red-50 text-red-700">
          <AlertTriangle className="w-4 h-4" /> {t("signaler.titre")}
        </button>
      </div>
      {liste.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">{t("file.vide")}</p>
      ) : (
        <div className="section-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chanv-fibre text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2">{t("file.type")}</th>
                <th className="px-3 py-2">{t("file.intervention")}</th>
                <th className="px-3 py-2">{t("file.ou")}</th>
                <th className="px-3 py-2">{t("file.qui")}</th>
                <th className="px-3 py-2">{t("file.echeance")}</th>
                <th className="px-3 py-2">{t("file.etat")}</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((iv) => (
                <tr key={iv.id} onClick={() => router.push(`/entretien/interventions/${encodeURIComponent(iv.id)}`)} className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 cursor-pointer">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {iv.genre === "probleme" ? <span className="text-red-700 font-semibold">{t("file.probleme", { p: iv.priorite ?? "" })}</span> : t("file.preventif")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-chanv-terre">{iv.genre === "probleme" ? `« ${iv.description.slice(0, 80)} »` : iv.titre}</div>
                    {iv.regleId && iv.genre === "preventif" && iv.checklist.length > 0 && <div className="text-[11px] text-slate-400">{t("intervention.checklist", { fait: iv.checklist.filter((c) => c.fait).length, total: iv.checklist.length })}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{[iv.lieu, iv.equipements].filter(Boolean).join(" · ")}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{iv.assignesNoms.join(", ") || <span className="text-amber-700">{t("file.personne")}</span>}</td>
                  <td className="px-3 py-2 text-xs whitespace-nowrap">{jourCourt(iv.echeance, locale)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <BadgeStatut statut={iv.statut} />
                      {(iv.retard ?? 0) > 0 && <BadgeRetard retard={iv.retard} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {signaler && (
        <SignalerForm
          salleId={null}
          gestionnaire={gestionnaire}
          onClose={() => setSignaler(false)}
          onFait={(id) => {
            setSignaler(false);
            recharger();
            router.push(`/entretien/interventions/${encodeURIComponent(id)}`);
          }}
        />
      )}
    </div>
  );
}

// ── Règles ──

function Regles({ regleId }: { regleId: string | null }) {
  const t = useT();
  const locale = useLocale();
  const freq = useFrequence();
  const { data, erreur, recharger } = useJson<{ regles: Regle[] }>("/api/entretien/regles");
  const [modifier, setModifier] = useState<Regle | null>(null);
  const [creer, setCreer] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [archivees, setArchivees] = useState(false);
  useEffect(() => {
    if (regleId && data) setModifier(data.regles.find((r) => r.id === regleId) ?? null);
  }, [regleId, data]);
  if (erreur) return <p className="text-sm text-red-600">{erreur}</p>;
  if (!data) return <Chargement />;
  const q = recherche.trim().toLowerCase();
  const liste = data.regles
    .filter((r) => archivees || r.etat !== "archivee")
    .filter((r) => !q || `${r.titre} ${r.equipementLibre} ${r.consigne}`.toLowerCase().includes(q));
  const retirer = async (r: Regle) => {
    const motif = window.prompt(t("regles.motifRetrait"), t("regles.motifDefaut"));
    if (motif === null) return;
    const res = await envoyer(`/api/entretien/regles/${encodeURIComponent(r.id)}`, "DELETE", { motif });
    if (!res.ok) window.alert(res.erreur);
    recharger();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t("regles.chercher")} className="text-sm border border-chanv-fibre rounded-lg px-3 py-1.5 bg-white" />
        <label className="text-xs flex items-center gap-1.5 text-slate-600"><input type="checkbox" checked={archivees} onChange={(e) => setArchivees(e.target.checked)} /> {t("regles.archivees")}</label>
        <span className="flex-1" />
        <button onClick={() => setCreer(true)} className="btn-primary text-xs"><Plus className="w-4 h-4" /> {t("regle.ajouterTitre")}</button>
      </div>
      {liste.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">{t("regles.vide")}</p>
      ) : (
        <div className="section-card divide-y divide-chanv-fibre/60">
          {liste.map((r) => (
            <div key={r.id} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-chanv-terre font-semibold">{r.titre}</div>
                <div className="text-[11px] text-slate-500">
                  {[freq(r.frequence), r.prochaine ? t("entretienSalle.prevueLe", { date: jourCourt(r.prochaine, locale) }) : null, r.equipementLibre || (r.actifIds.length ? t("regles.nEquipements", { n: r.actifIds.length }) : r.salleIds.join(", ")), r.origine?.refs?.length ? r.origine.refs.join(", ") : null].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span className={`badge text-[10px] ${r.etat === "active" ? "bg-emerald-100 text-emerald-800" : r.etat === "a_completer" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{t(`regles.etat.${r.etat}`)}</span>
              {r.etat !== "archivee" && (
                <>
                  <button onClick={() => setModifier(r)} className="p-1.5 text-slate-400 hover:text-chanv-terre" aria-label={t("regles.modifier")}><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => retirer(r)} className="text-[11px] text-slate-400 hover:text-red-700 underline">{t("regles.retirer")}</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {(creer || modifier) && (
        <RegleDialog
          mode={modifier ? "modifier" : "creer"}
          regleId={modifier?.id}
          initiale={modifier ?? {}}
          onClose={() => {
            setCreer(false);
            setModifier(null);
          }}
          onSaved={() => {
            setCreer(false);
            setModifier(null);
            recharger();
          }}
        />
      )}
    </div>
  );
}

// ── Équipe et listes ──

function Equipe({ admin }: { admin: boolean }) {
  const t = useT();
  const personnes = usePersonnes();
  const { data, erreur, recharger } = useJson<{ config: ConfigEntretien; noms: Record<string, string>; branchements: { taches: boolean; avis: boolean } }>("/api/entretien/config");
  const [c, setC] = useState<ConfigEntretien | null>(null);
  const [ajout, setAjout] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    if (data) setC(data.config);
  }, [data]);
  if (erreur) return <p className="text-sm text-red-600">{erreur}</p>;
  if (!data || !c) return <Chargement />;
  const nom = (e: string) => personnes.find((p) => p.email === e)?.nom || data.noms[e] || e;
  const enregistrer = async () => {
    setEnvoi(true);
    const r = await envoyer("/api/entretien/config", "PUT", c);
    setEnvoi(false);
    setMessage(r.ok ? { ok: true, texte: t("equipe.enregistre") } : { ok: false, texte: r.erreur });
    if (r.ok) recharger();
  };
  const lecture = !admin;
  return (
    <div className="space-y-4 max-w-3xl">
      {(!c.responsable || !c.equipe.length) && (
        <div className="section-card p-4 border-l-4 border-l-amber-400 text-sm text-chanv-terre">
          <strong>{t("equipe.aChoisir")}</strong>
          <p className="text-slate-600 mt-1">{t("equipe.aChoisirTexte")}</p>
        </div>
      )}
      {(!data.branchements.taches || !data.branchements.avis) && (
        <div className="section-card p-4 border-l-4 border-l-red-400 text-sm text-red-700">{t("equipe.nonBranche")}</div>
      )}
      <div className="card p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t("equipe.responsable")}</label>
          {lecture ? <p className="text-sm">{c.responsable ? nom(c.responsable) : "—"}</p> : <ChoixPersonne valeur={c.responsable} onChange={(e) => setC({ ...c, responsable: e })} placeholder={t("regle.chercherPersonne")} id="resp-entretien" />}
          <p className="text-[11px] text-slate-400 mt-1">{t("equipe.responsableAide")}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t("equipe.equipe")}</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {c.equipe.map((e) => (
              <span key={e} className="badge text-xs bg-chanv-fibre text-chanv-terre">
                {nom(e)}
                {!lecture && <button onClick={() => setC({ ...c, equipe: c.equipe.filter((x) => x !== e) })} className="ml-1 text-slate-500">×</button>}
              </span>
            ))}
            {!c.equipe.length && <span className="text-xs text-slate-400">—</span>}
          </div>
          {!lecture && (
            <div className="flex gap-2">
              <div className="flex-1"><ChoixPersonne valeur={ajout} onChange={setAjout} placeholder={t("regle.chercherPersonne")} id="equipe-entretien" /></div>
              <button onClick={() => { if (ajout && !c.equipe.includes(ajout)) setC({ ...c, equipe: [...c.equipe, ajout] }); setAjout(""); }} className="btn-ghost border border-chanv-fibre text-xs"><Plus className="w-4 h-4" /></button>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-1">{t("equipe.equipeAide")}</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t("equipe.metiers")}</label>
          <div className="space-y-2">
            {c.listes.metiers.map((m) => (
              <div key={m} className="grid grid-cols-[180px_1fr] gap-2 items-center">
                <span className="text-sm">{m}</span>
                {lecture ? <span className="text-sm text-slate-600">{c.metiers[m] ? nom(c.metiers[m]) : "—"}</span> : (
                  <ChoixPersonne valeur={c.metiers[m] || ""} onChange={(e) => setC({ ...c, metiers: { ...c.metiers, [m]: e } })} placeholder={t("equipe.personneParDefaut")} id={`metier-${m}`} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {(["projetGandalf", "listePreventifs", "listeProblemes"] as const).map((k) => (
            <div key={k}>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t(`equipe.${k}`)}</label>
              <input value={c[k]} disabled={lecture} onChange={(e) => setC({ ...c, [k]: e.target.value.trim() })} className="w-full text-xs font-mono border border-chanv-fibre rounded-lg px-2 py-1.5 bg-white" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" disabled={lecture} checked={c.tachesActives} onChange={(e) => setC({ ...c, tachesActives: e.target.checked })} /> {t("equipe.tachesActives")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={lecture} checked={c.avisActifs} onChange={(e) => setC({ ...c, avisActifs: e.target.checked })} /> {t("equipe.avisActifs")}</label>
        </div>
        {(["types", "criticites", "metiers"] as const).map((k) => (
          <div key={k}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t(`equipe.liste.${k}`)}</label>
            <textarea
              disabled={lecture}
              value={c.listes[k].join("\n")}
              onChange={(e) => setC({ ...c, listes: { ...c.listes, [k]: e.target.value.split("\n") } })}
              rows={Math.min(8, c.listes[k].length + 1)}
              className="w-full text-xs border border-chanv-fibre rounded-lg px-2 py-1.5 bg-white"
            />
          </div>
        ))}
        {!lecture && (
          <div className="flex items-center gap-3">
            <button onClick={enregistrer} disabled={envoi} className="btn-primary text-sm">{envoi && <Loader2 className="w-4 h-4 animate-spin" />}{t("entretien.enregistrer")}</button>
            {message && <span className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.texte}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── V11 : la séance de reprise de la GMAO ──

function Reprise() {
  const t = useT();
  const { data, erreur, recharger } = useJson<{ lignes: LigneReprise[] }>("/api/entretien/reprise");
  const [corriger, setCorriger] = useState<LigneReprise | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [bilan, setBilan] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (erreur) return <p className="text-sm text-red-600">{erreur}</p>;
  if (!data) return <Chargement />;
  const lignes = data.lignes;
  const decidees = lignes.filter((l) => ["garder", "fusionner", "de_cote"].includes(l.decision) || l.importeA).length;
  const aImporter = lignes.filter((l) => !l.importeA && ["garder", "fusionner", "de_cote"].includes(l.decision)).length;
  const decider = async (l: LigneReprise, decision: LigneReprise["decision"]) => {
    let noteDecision: string | undefined;
    if (decision === "de_cote" || decision === "fusionner") {
      const n = window.prompt(decision === "de_cote" ? t("reprise.raison") : t("reprise.fusionAvec"), l.noteDecision || "");
      if (n === null) return;
      noteDecision = n;
    }
    setEnvoi(l.id);
    const r = await envoyer(`/api/entretien/reprise/${encodeURIComponent(l.id)}`, "PATCH", { decision, noteDecision });
    setEnvoi(null);
    setMessage(r.ok ? null : r.erreur);
    recharger();
  };
  const importer = async () => {
    if (!window.confirm(t("reprise.confirmer", { n: aImporter }))) return;
    setEnvoi("import");
    const r = await envoyer<{ bilan: Record<string, unknown> }>("/api/entretien/reprise/importer", "POST");
    setEnvoi(null);
    if (r.ok) setBilan(r.data.bilan);
    else setMessage(r.erreur);
    recharger();
  };
  if (!lignes.length) return <p className="text-sm text-slate-500">{t("reprise.vide")}</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-slate-600 flex-1 min-w-[260px]">{t("reprise.intro")}</p>
        <span className="badge text-xs bg-chanv-fibre text-chanv-terre">{t("reprise.decides", { n: decidees, total: lignes.length })}</span>
        <button onClick={importer} disabled={!aImporter || envoi !== null} className="btn-primary text-sm">
          {envoi === "import" && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("reprise.importer", { n: aImporter })}
        </button>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
      {bilan && (
        <div className="text-sm bg-emerald-50 text-emerald-900 rounded-lg p-3 space-y-1">
          <p>{t("reprise.bilan", { regles: String(bilan.regles ?? 0), aCompleter: String(bilan.aCompleter ?? 0), remplacees: String(bilan.tachesRemplacees ?? 0) })}</p>
          {((bilan.tachesNonRemplacees as string[]) ?? []).map((x) => <p key={x} className="text-amber-800 text-xs">{t("reprise.nonRemplacee", { x })}</p>)}
          {((bilan.erreurs as string[]) ?? []).map((x) => <p key={x} className="text-red-700 text-xs">{x}</p>)}
        </div>
      )}
      <div className="section-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chanv-fibre text-left text-[11px] uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2">{t("reprise.trouve")}</th>
              <th className="px-3 py-2">{t("reprise.source")}</th>
              <th className="px-3 py-2">{t("reprise.proposition")}</th>
              <th className="px-3 py-2">{t("reprise.decision")}</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className="border-b border-chanv-fibre/50 align-top">
                <td className="px-3 py-2">
                  <div className="font-semibold text-chanv-terre">{l.titre}</div>
                  <div className="text-[12px] text-slate-600">{l.constat}</div>
                  {l.tachesARemplacer.length > 0 && (
                    <div className="text-[11px] text-slate-400 mt-1">{t("reprise.taches", { n: l.tachesARemplacer.length, liste: l.tachesARemplacer.map((x) => x.echeance || "—").join(", ") })}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">{l.source}</td>
                <td className="px-3 py-2 text-xs text-slate-700">
                  {l.proposition}
                  {l.noteDecision && <div className="text-[11px] text-slate-500 mt-1">« {l.noteDecision} »</div>}
                </td>
                <td className="px-3 py-2">
                  {l.importeA ? (
                    <span className="badge text-[11px] bg-emerald-100 text-emerald-800">{t("reprise.importee")}</span>
                  ) : (
                    <div className="flex flex-col items-start gap-1">
                      <span className={`badge text-[11px] ${l.decision === "a_decider" ? "bg-amber-100 text-amber-800" : l.decision === "propose" ? "bg-sky-100 text-sky-800" : "bg-chanv-fibre text-chanv-terre"}`}>{t(`reprise.d.${l.decision}`)}</span>
                      <div className="flex flex-wrap gap-1">
                        {l.regle && <button disabled={envoi !== null} onClick={() => decider(l, "garder")} className="text-[11px] underline text-emerald-700">{t("reprise.garder")}</button>}
                        {l.regle && <button disabled={envoi !== null} onClick={() => setCorriger(l)} className="text-[11px] underline text-chanv-terre">{t("reprise.corriger")}</button>}
                        <button disabled={envoi !== null} onClick={() => decider(l, "fusionner")} className="text-[11px] underline text-slate-600">{t("reprise.fusionner")}</button>
                        <button disabled={envoi !== null} onClick={() => decider(l, "de_cote")} className="text-[11px] underline text-slate-600">{t("reprise.deCote")}</button>
                        {l.decision !== "a_decider" && <button disabled={envoi !== null} onClick={() => decider(l, "a_decider")} className="text-[11px] underline text-slate-400">{t("reprise.revenir")}</button>}
                      </div>
                      {l.groupe === "rattachement" && <Link href="/admin" className="text-[11px] underline text-chanv-terre">{t("reprise.versAdmin")}</Link>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {corriger && corriger.regle && (
        <RegleDialog
          mode="reprise"
          repriseId={corriger.id}
          initiale={corriger.regle}
          onClose={() => setCorriger(null)}
          onSaved={() => {
            setCorriger(null);
            recharger();
          }}
        />
      )}
    </div>
  );
}

function Encart({ titre, valeur, rouge = false }: { titre: string; valeur: string; rouge?: boolean }) {
  return (
    <div className="section-card p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{titre}</div>
      <div className={`text-lg font-bold ${rouge ? "text-red-700" : "text-chanv-terre"}`}>{valeur}</div>
    </div>
  );
}

function Chargement() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
    </div>
  );
}
