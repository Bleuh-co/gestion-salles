"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Camera, FileText, History, Loader2, Plus, Printer, Wrench } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { useJson } from "@/components/registre/commun";
import { RegistreTab } from "@/components/registre/RegistreTab";
import { BadgeRetard, BadgeStatut, envoyer, jourCourt, reduirePhoto, useFrequence, type VueActif } from "./commun";
import { RegleDialog } from "./RegleDialog";
import { SignalerForm } from "./SignalerForm";

// ============================================================
// La page d'un équipement (maquette V2) : ses photos, sa plaque, sa
// fiche, son plan d'entretien, son historique et ses documents.
// ============================================================

type Onglet = "entretien" | "historique" | "documents";

export function ActifPage({ actifId }: { actifId: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const freq = useFrequence();
  const { data, erreur, recharger } = useJson<VueActif & { gestionnaire: boolean }>(`/api/entretien/actifs/${encodeURIComponent(actifId)}`);
  const [onglet, setOnglet] = useState<Onglet>("entretien");
  const [ajouter, setAjouter] = useState(false);
  const [signaler, setSignaler] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  if (erreur) return <p className="text-sm text-red-600 pt-6">{erreur}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
      </div>
    );
  }
  const a = data.actif;
  const ouvertes = data.interventions.filter((iv) => !["validee", "annulee"].includes(iv.statut));
  const fermees = data.interventions.filter((iv) => ["validee", "annulee"].includes(iv.statut));
  const entretenuPar = [...new Set(data.regles.map((r) => r.quiNom).filter(Boolean))];
  const [photo, ...autres] = data.photos;

  const ajouterPhoto = async (f: File | undefined) => {
    if (!f) return;
    setEnvoi(true);
    setMessage(null);
    const form = new FormData();
    form.set("fichier", await reduirePhoto(f, 2000));
    const r = await envoyer(`/api/entretien/actifs/${encodeURIComponent(a.id)}/photos`, "POST", form);
    setEnvoi(false);
    if (!r.ok) setMessage(r.erreur);
    else recharger();
  };

  return (
    <div className="space-y-5 pt-6">
      <div className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
        <Link href="/salles" className="flex items-center gap-1 hover:text-chanv-terre">
          <ArrowLeft className="w-3 h-3" /> {t("nav.rooms")}
        </Link>
        {a.idSalle && (
          <>
            <span>/</span>
            <Link href={`/salles/${encodeURIComponent(a.idSalle)}#entretien`} className="hover:text-chanv-terre">{a.idSalle}</Link>
          </>
        )}
        <span>/</span>
        <span className="text-chanv-terre font-medium">{a.nom || a.id}</span>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-5">
        <div className="space-y-3">
          {photo ? (
            <a href={photo.lien} target="_blank" rel="noreferrer" className="block rounded-2xl border border-chanv-fibre bg-white overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.lien} alt={a.nom} className="w-full aspect-[3/4] object-cover" />
              <div className="px-3 py-2 text-[11px] text-slate-500">{(photo as { legende?: string }).legende || t("actif.photo")}</div>
            </a>
          ) : (
            <div className="rounded-2xl border border-chanv-fibre bg-white aspect-[3/4] flex items-center justify-center text-slate-400 text-sm">{t("actif.sansPhoto")}</div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {autres.map((p) => (
              <a key={p.lien} href={p.lien} target="_blank" rel="noreferrer" className="rounded-xl border border-chanv-fibre bg-white overflow-hidden block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.lien} alt={p.nom} className="w-full aspect-square object-cover" />
                <div className="px-2 py-1 text-[10px] text-slate-500 truncate">{(p as { legende?: string }).legende || p.nom}</div>
              </a>
            ))}
            {data.gestionnaire && (
              <button onClick={() => champ.current?.click()} disabled={envoi} className="rounded-xl border-2 border-dashed border-chanv-fibre bg-white aspect-square flex flex-col items-center justify-center text-slate-500 text-xs gap-1">
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {t("actif.ajouterPhoto")}
              </button>
            )}
            <input ref={champ} type="file" accept="image/*" capture="environment" hidden onChange={(e) => ajouterPhoto(e.target.files?.[0])} />
          </div>
          {message && <p className="text-xs text-red-600">{message}</p>}
        </div>

        <div className="space-y-4 min-w-0">
          <div className="card p-5">
            <div className="flex items-start gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-chanv-terre">{a.nom || a.id}</h1>
              {a.statut && <span className="badge text-xs bg-amber-50 text-amber-800">{a.statut}</span>}
              {a.criticite && <span className="badge text-xs bg-red-50 text-red-700">{t("actif.criticite", { c: a.criticite })}</span>}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {[a.matricule, a.categorie, a.idSalle ? t("actif.salle", { salle: data.salleNom ? `${data.salleNom} (${a.idSalle})` : a.idSalle }) : t("regle.sansSalle")].filter(Boolean).join(" · ")}
            </p>
            <dl className="grid sm:grid-cols-[170px_1fr] gap-x-4 gap-y-2 mt-4 text-sm">
              <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold pt-0.5">{t("actif.fabricant")}</dt>
              <dd>{[a.marque, a.modele].filter(Boolean).join(" ") || "—"}</dd>
              <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold pt-0.5">{t("actif.serie")}</dt>
              <dd>{a.numSerie || "—"}</dd>
              <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold pt-0.5">{t("actif.installe")}</dt>
              <dd>{a.dateInstall || "—"}</dd>
              <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold pt-0.5">{t("actif.fiche")}</dt>
              <dd>
                {data.documents.length ? (
                  data.documents.map((d) => (
                    <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="underline text-chanv-terre mr-3">{d.nom}</a>
                  ))
                ) : (
                  <span className="text-slate-500">{a.idMasterlist ? t("actif.ficheAucuneCode", { code: a.idMasterlist }) : t("actif.ficheAucune")}</span>
                )}
              </dd>
              <dt className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold pt-0.5">{t("actif.entretenuPar")}</dt>
              <dd>{entretenuPar.join(" ; ") || "—"}</dd>
            </dl>
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => setSignaler(true)} className="btn-ghost text-xs border border-red-200 bg-red-50 text-red-700">
                <AlertTriangle className="w-4 h-4" /> {t("signaler.titre")}
              </button>
              {data.gestionnaire && (
                <button onClick={() => setAjouter(true)} className="btn-ghost text-xs border border-chanv-fibre">
                  <Plus className="w-4 h-4" /> {t("regle.ajouterTitre")}
                </button>
              )}
              <Link href={`/actifs/${encodeURIComponent(a.id)}/fiche-de-vie`} target="_blank" className="btn-ghost text-xs border border-chanv-fibre">
                <Printer className="w-4 h-4" /> {t("actif.ficheDeVie")}
              </Link>
            </div>
          </div>

          <div className="flex gap-1 border-b border-chanv-fibre" role="tablist">
            {([
              ["entretien", Wrench, data.regles.length + ouvertes.length],
              ["historique", History, undefined],
              ["documents", FileText, data.documents.length],
            ] as const).map(([k, Icone, n]) => (
              <button
                key={k}
                role="tab"
                aria-selected={onglet === k}
                onClick={() => setOnglet(k)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl ${onglet === k ? "bg-chanv-fibre text-chanv-terre" : "text-slate-500 hover:text-chanv-terre"}`}
              >
                <Icone className="w-4 h-4" /> {t(`actif.onglet.${k}`)}
                {n !== undefined && <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-chanv-terre/10 font-bold">{n}</span>}
              </button>
            ))}
          </div>

          {onglet === "entretien" && (
            <div className="space-y-2">
              {data.regles.length === 0 && ouvertes.length === 0 && <p className="text-sm text-slate-500">{t("actif.aucunEntretien")}</p>}
              {data.regles.map((r) => {
                const iv = ouvertes.find((x) => x.id === r.interventionOuverte);
                const corps = (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-chanv-terre"><strong>{r.titre}</strong>{r.quiNom ? <> {t("actif.par", { qui: r.quiNom })}</> : null}</div>
                      <div className="text-[12px] text-slate-500">
                        {[r.consigne ? `« ${r.consigne.slice(0, 100)} »` : null, freq(r.frequence), r.calcul === "faite" ? t("regle.calculFaite") : t("regle.calculPrevue"), r.prochaine ? t("entretienSalle.prevueLe", { date: jourCourt(r.prochaine, locale) }) : t("entretienSalle.aPlanifier")].filter(Boolean).join(" · ")}
                      </div>
                      {r.preuve !== "aucune" && <div className="text-[11px] text-slate-400">{t("actif.preuve", { quoi: t(`regle.preuve.${r.preuve}`) })}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {iv && <BadgeStatut statut={iv.statut} />}
                      {r.etatVue === "en_retard" && <BadgeRetard retard={r.retard} />}
                      {r.etatVue === "a_planifier" && <span className="badge text-[11px] bg-sky-100 text-sky-700">{t("entretienSalle.aPlanifier")}</span>}
                    </div>
                  </>
                );
                return iv ? (
                  <Link key={r.id} href={`/entretien/interventions/${encodeURIComponent(iv.id)}`} className="section-card p-4 flex items-start gap-3 hover:bg-chanv-fibre/20">{corps}</Link>
                ) : (
                  <div key={r.id} className="section-card p-4 flex items-start gap-3">{corps}</div>
                );
              })}
              {ouvertes.filter((iv) => iv.genre === "probleme" || !data.regles.some((r) => r.interventionOuverte === iv.id)).map((iv) => (
                <button key={iv.id} onClick={() => router.push(`/entretien/interventions/${encodeURIComponent(iv.id)}`)} className="section-card p-4 w-full text-left flex items-start gap-3 hover:bg-chanv-fibre/20">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-chanv-terre"><strong>{iv.genre === "probleme" ? `« ${iv.description.slice(0, 100)} »` : iv.titre}</strong></div>
                    <div className="text-[12px] text-slate-500">{[iv.assignesNoms.join(", "), iv.echeance ? t("entretienSalle.prevueLe", { date: jourCourt(iv.echeance, locale) }) : null].filter(Boolean).join(" · ")}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1"><BadgeStatut statut={iv.statut} /><BadgeRetard retard={iv.retard} /></div>
                </button>
              ))}
              {fermees.length > 0 && (
                <>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-2">{t("entretienSalle.fermees")}</h3>
                  {fermees.map((iv) => (
                    <Link key={iv.id} href={`/entretien/interventions/${encodeURIComponent(iv.id)}`} className="section-card p-3 flex items-center gap-3 text-sm hover:bg-chanv-fibre/20">
                      <span className="flex-1 min-w-0 truncate">{iv.genre === "probleme" ? iv.description : iv.titre}</span>
                      <span className="text-[11px] text-slate-400">{(iv.valideA || iv.annuleA || "").slice(0, 10)}</span>
                      <BadgeStatut statut={iv.statut} />
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}
          {onglet === "historique" && a.idSalle && (
            <RegistreTab salleId={a.idSalle} noms={{}} filtreActif={{ id: a.id, nom: a.nom || a.matricule || a.id }} onEffacerFiltre={() => setOnglet("entretien")} onExporter={() => router.push(`/salles/${encodeURIComponent(a.idSalle)}#registre`)} />
          )}
          {onglet === "historique" && !a.idSalle && <p className="text-sm text-slate-500">{t("actif.historiqueSansSalle")}</p>}
          {onglet === "documents" && (
            <div className="space-y-2">
              {data.documents.length === 0 && <p className="text-sm text-slate-500">{t("actif.aucunDocument")}</p>}
              {data.documents.map((d) => (
                <a key={d.url} href={d.url} target="_blank" rel="noreferrer" className="section-card p-3 flex items-center gap-3 text-sm hover:bg-chanv-fibre/20">
                  <FileText className="w-4 h-4 text-chanv-terre" />
                  <span className="flex-1">{d.nom}</span>
                  <span className="text-[11px] text-slate-400">{d.source}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {ajouter && (
        <RegleDialog
          mode="creer"
          initiale={{ actifIds: [a.id] }}
          onClose={() => setAjouter(false)}
          onSaved={() => {
            setAjouter(false);
            recharger();
          }}
        />
      )}
      {signaler && (
        <SignalerForm
          salleId={a.idSalle || null}
          actifId={a.id}
          gestionnaire={data.gestionnaire}
          onClose={() => setSignaler(false)}
          onFait={(id) => router.push(`/entretien/interventions/${encodeURIComponent(id)}`)}
        />
      )}
    </div>
  );
}
