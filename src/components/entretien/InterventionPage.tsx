"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, CheckSquare, ExternalLink, FileText, Loader2, Square } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { useJson } from "@/components/registre/commun";
import { CLASSE_CHAMP } from "@/components/registre/Fenetre";
import type { Regle } from "@/lib/entretien/types";
import { BadgeRetard, BadgeStatut, ChoixPersonne, envoyer, instantCourt, jourCourt, reduirePhoto, useFrequence, type InterventionVue } from "./commun";

// ============================================================
// Une intervention (maquette V6) : la consigne, la liste de contrôle,
// la preuve, « Terminé — à valider ». Le responsable y assigne, valide
// ou renvoie. Lien direct vers la tâche GANDALF.
// ============================================================

interface Reponse {
  intervention: InterventionVue;
  regle: Regle | null;
  droits: { faire: boolean; gerer: boolean };
  config: { responsable: boolean; priorites: string[] };
}

export function InterventionPage({ id, hubUrl }: { id: string; hubUrl: string }) {
  const t = useT();
  const locale = useLocale();
  const freq = useFrequence();
  const { data, erreur, recharger } = useJson<Reponse>(`/api/entretien/interventions/${encodeURIComponent(id)}`);
  const [mesure, setMesure] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [motif, setMotif] = useState("");
  const [assignes, setAssignes] = useState("");
  const [geste, setGeste] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [remettre, setRemettre] = useState(true);
  const champ = useRef<HTMLInputElement>(null);

  if (erreur) return <p className="text-sm text-red-600 pt-6">{erreur}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
      </div>
    );
  }
  const iv = data.intervention;
  const ouverte = ["a_assigner", "a_faire", "en_cours", "en_attente"].includes(iv.statut);
  const faire = data.droits.faire && ["a_faire", "en_cours", "en_attente"].includes(iv.statut);
  const valeurMesure = mesure ?? iv.mesure;
  const checklistFaite = iv.checklist.every((c) => c.fait);
  const preuveOk =
    iv.preuveExigee === "aucune" ||
    (iv.preuveExigee === "mesure" ? !!valeurMesure.trim() : iv.preuveExigee === "photo" ? iv.preuves.some((p) => p.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(p.nom)) : iv.preuves.length > 0);

  const agir = async (nom: string, corps: Record<string, unknown>) => {
    setGeste(nom);
    setMessage(null);
    const r = await envoyer(`/api/entretien/interventions/${encodeURIComponent(id)}`, "PATCH", corps);
    setGeste(null);
    if (!r.ok) setMessage({ ok: false, texte: r.erreur });
    else {
      setMessage({ ok: true, texte: t(`intervention.fait.${nom}`) });
      setMotif("");
      recharger();
    }
  };

  const deposer = async (liste: FileList | null) => {
    if (!liste?.length) return;
    setGeste("preuve");
    const form = new FormData();
    for (const f of [...liste].slice(0, 6)) form.append("fichiers", await reduirePhoto(f));
    const r = await envoyer(`/api/entretien/interventions/${encodeURIComponent(id)}/preuves`, "POST", form);
    setGeste(null);
    if (!r.ok) setMessage({ ok: false, texte: r.erreur });
    else recharger();
  };

  const libellePreuve = { aucune: "", photo: t("intervention.preuvePhoto"), rapport: t("intervention.preuveRapport"), mesure: t("intervention.preuveMesure", { unite: iv.mesureUnite || "" }) }[iv.preuveExigee];

  return (
    <div className="space-y-5 pt-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href={iv.salleIds[0] ? `/salles/${encodeURIComponent(iv.salleIds[0])}#entretien` : "/entretien"} className="flex items-center gap-1 hover:text-chanv-terre">
          <ArrowLeft className="w-3 h-3" /> {iv.lieu || t("nav.entretien")}
        </Link>
      </div>

      <div className="card p-5 space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
          {iv.genre === "probleme" ? t("intervention.probleme") : t("intervention.preventif")} · {iv.type}
        </div>
        <h1 className="text-lg font-bold text-chanv-terre">{iv.genre === "probleme" ? iv.description.slice(0, 160) : iv.titre}</h1>
        <p className="text-sm text-slate-600">
          {[iv.equipements, iv.lieu].filter(Boolean).join(" · ")}
          {data.regle?.frequence ? ` · ${freq(data.regle.frequence)}` : ""}
          {iv.echeance ? ` · ${t("entretienSalle.prevueLe", { date: jourCourt(iv.echeance, locale) })}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeStatut statut={iv.statut} />
          <BadgeRetard retard={iv.retard} />
          {iv.genre === "probleme" && iv.priorite != null && (
            <span className={`badge text-[11px] ${iv.priorite <= 1 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
              {data.config.priorites[iv.priorite] ?? iv.priorite}
            </span>
          )}
          {iv.assignesNoms.length > 0 && <span className="text-xs text-slate-500">{t("intervention.pour", { noms: iv.assignesNoms.join(", ") })}</span>}
          {iv.tacheId && (
            <a href={`${hubUrl}/?view=tasks&task=${encodeURIComponent(iv.tacheId)}`} target="_top" className="text-xs underline text-chanv-terre inline-flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> {t("intervention.tacheGandalf")}
            </a>
          )}
        </div>
      </div>

      {iv.genre === "probleme" && (
        <div className="section-card p-4 space-y-2">
          <div className="text-sm">{iv.description}</div>
          <div className="text-[12px] text-slate-500">
            {t("intervention.signaleLe", { nom: iv.signalePar?.nom || iv.signalePar?.email || "—", date: instantCourt(iv.creeA, locale) })}
            {iv.horsService ? ` · ${t("ligne.horsServiceSuite")}` : ""}
          </div>
          {iv.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {iv.photos.map((p) => (
                <a key={p.lien} href={p.lien} target="_blank" rel="noreferrer" className="w-24 h-24 rounded-lg overflow-hidden border border-chanv-fibre block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.lien} alt={p.nom} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {(iv.consigne || data.regle?.procedureUrl) && (
        <div className="section-card p-4 text-sm">
          {iv.consigne && <p>{t("intervention.consigne")} : « {iv.consigne} »</p>}
          {data.regle?.procedureUrl && (
            <a href={data.regle.procedureUrl} target="_blank" rel="noreferrer" className="text-xs underline text-chanv-terre inline-flex items-center gap-1 mt-1">
              <FileText className="w-3 h-3" /> {t("intervention.procedure")}
            </a>
          )}
        </div>
      )}

      {iv.checklist.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {t("intervention.checklist", { fait: iv.checklist.filter((c) => c.fait).length, total: iv.checklist.length })}
          </h3>
          <div className="section-card !p-1 divide-y divide-chanv-fibre/60">
            {iv.checklist.map((c, i) => (
              <button
                key={i}
                disabled={!faire || geste !== null}
                onClick={() => agir("cocher", { action: "cocher", index: i, fait: !c.fait })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm disabled:cursor-default"
              >
                {c.fait ? <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" /> : <Square className="w-5 h-5 text-slate-400 shrink-0" />}
                <span className={c.fait ? "text-slate-500" : "text-chanv-terre"}>{c.texte}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(iv.preuveExigee !== "aucune" || iv.preuves.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {libellePreuve ? t("intervention.preuveExigee", { quoi: libellePreuve }) : t("intervention.preuves")}
          </h3>
          {iv.preuves.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {iv.preuves.map((p) => (
                <a key={p.lien || p.nom} href={p.lien} target="_blank" rel="noreferrer" className="block w-24">
                  {p.type.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.lien} alt={p.nom} className="w-24 h-24 object-cover rounded-lg border border-chanv-fibre" />
                  ) : (
                    <div className="w-24 h-24 rounded-lg border border-chanv-fibre flex flex-col items-center justify-center text-[10px] text-slate-500 p-1 text-center">
                      <FileText className="w-6 h-6" />
                      <span className="truncate w-full">{p.nom}</span>
                    </div>
                  )}
                  <span className="block text-[10px] text-slate-400 truncate">{p.parNom}</span>
                </a>
              ))}
            </div>
          )}
          {faire && iv.preuveExigee !== "mesure" && (
            <>
              <button onClick={() => champ.current?.click()} disabled={geste !== null} className="w-full border-2 border-dashed border-chanv-fibre rounded-xl py-4 text-sm text-slate-600 flex items-center justify-center gap-2">
                {geste === "preuve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {iv.preuveExigee === "rapport" ? t("intervention.ajouterRapport") : t("intervention.ajouterPhoto")}
              </button>
              <input ref={champ} type="file" hidden multiple accept={iv.preuveExigee === "rapport" ? "image/*,application/pdf" : "image/*"} capture={iv.preuveExigee === "rapport" ? undefined : "environment"} onChange={(e) => deposer(e.target.files)} />
            </>
          )}
          {iv.preuveExigee === "mesure" && (
            <input value={valeurMesure} disabled={!faire} onChange={(e) => setMesure(e.target.value)} placeholder={t("intervention.valeur", { unite: iv.mesureUnite || "" })} className={CLASSE_CHAMP} />
          )}
        </div>
      )}

      {faire && (
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t("intervention.note")}</h3>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} className={CLASSE_CHAMP} placeholder={t("intervention.noteExemple")} />
          <button
            onClick={() => agir("terminer", { action: "terminer", checklist: iv.checklist.map((c) => c.fait), mesure: valeurMesure, note })}
            disabled={geste !== null || !checklistFaite || !preuveOk}
            className="btn-primary w-full py-3 text-base"
          >
            {geste === "terminer" && <Loader2 className="w-4 h-4 animate-spin" />}
            {t("intervention.terminer")}
          </button>
          {(!checklistFaite || !preuveOk) && <p className="text-[11px] text-slate-500 text-center">{t("intervention.terminerAide")}</p>}
          <div className="flex flex-wrap gap-2 justify-center">
            {iv.statut === "a_faire" && (
              <button onClick={() => agir("en_cours", { action: "en_cours", note: "" })} disabled={geste !== null} className="btn-ghost text-xs border border-chanv-fibre">{t("intervention.jeMyMets")}</button>
            )}
            {iv.statut !== "en_attente" ? (
              <button onClick={() => note.trim() ? agir("en_attente", { action: "en_attente", note }) : setMessage({ ok: false, texte: t("intervention.motifAttente") })} disabled={geste !== null} className="btn-ghost text-xs border border-chanv-fibre">{t("intervention.enAttente")}</button>
            ) : (
              <button onClick={() => agir("en_cours", { action: "en_cours", note: "" })} disabled={geste !== null} className="btn-ghost text-xs border border-chanv-fibre">{t("intervention.reprendre")}</button>
            )}
          </div>
        </div>
      )}

      {data.droits.gerer && (
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-bold text-chanv-terre">{t("intervention.responsable")}</h3>
          {iv.statut === "a_valider" && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                {t("intervention.termineLe", { nom: iv.terminePar?.nom || iv.terminePar?.email || "—", date: instantCourt(iv.termineA, locale) })}
                {iv.noteFin ? ` — « ${iv.noteFin} »` : ""}
                {iv.mesure ? ` — ${iv.mesure} ${iv.mesureUnite}` : ""}
              </p>
              {!preuveOk && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t("intervention.preuveManquante")}</p>}
              {iv.horsService && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={remettre} onChange={(e) => setRemettre(e.target.checked)} /> {t("intervention.remettreEnService")}
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => agir("valider", { action: "valider", remettreEnService: remettre })} disabled={geste !== null} className="btn-primary text-sm">{t("intervention.valider")}</button>
                <button onClick={() => motif.trim() ? agir("refuser", { action: "refuser", motif }) : setMessage({ ok: false, texte: t("intervention.motifRefus") })} disabled={geste !== null} className="btn-ghost text-sm border border-chanv-fibre">{t("intervention.refuser")}</button>
              </div>
            </div>
          )}
          {ouverte && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500">{iv.assignes.length ? t("intervention.reassigner") : t("intervention.assigner")}</label>
              <div className="flex gap-2">
                <div className="flex-1"><ChoixPersonne valeur={assignes} onChange={setAssignes} placeholder={t("regle.chercherPersonne")} id="assigner-intervention" /></div>
                <button onClick={() => agir("assigner", { action: "assigner", assignes: [assignes] })} disabled={geste !== null || !assignes} className="btn-primary text-sm">{t("intervention.assignerBouton")}</button>
              </div>
              {!iv.tacheId && iv.assignes.length === 0 && <p className="text-[11px] text-slate-500">{t("intervention.assignerAide")}</p>}
            </div>
          )}
          {(ouverte || iv.statut === "a_valider") && (
            <div className="space-y-2">
              <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={t("intervention.motif")} className={CLASSE_CHAMP} />
              <button onClick={() => motif.trim() ? agir("annuler", { action: "annuler", motif }) : setMessage({ ok: false, texte: t("intervention.motifAnnulation") })} disabled={geste !== null} className="btn-ghost text-xs border border-red-200 text-red-700">{t("intervention.annuler")}</button>
            </div>
          )}
        </div>
      )}

      {!faire && !data.droits.gerer && ouverte && <p className="text-xs text-slate-500 text-center">{t("intervention.lectureSeule")}</p>}
      {message && <p className={`text-sm text-center ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.texte}</p>}

      <div className="text-[11px] text-slate-400 space-y-0.5 pb-8">
        <div>{t("intervention.creeLe", { date: instantCourt(iv.creeA, locale) })}</div>
        {iv.termineA && <div>{t("intervention.termineLe", { nom: iv.terminePar?.nom || "—", date: instantCourt(iv.termineA, locale) })}</div>}
        {iv.valideA && <div>{t("intervention.valideLe", { nom: iv.validePar?.nom || "—", date: instantCourt(iv.valideA, locale) })}</div>}
        {iv.annuleA && <div>{t("intervention.annuleeLe", { nom: iv.annulePar?.nom || "—", date: instantCourt(iv.annuleA, locale), motif: iv.motif })}</div>}
      </div>
    </div>
  );
}
