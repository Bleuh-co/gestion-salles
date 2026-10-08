"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Flag, Loader2, Plus, Wrench } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { useJson } from "@/components/registre/commun";
import { EmptyState } from "@/components/EmptyState";
import { BadgeRetard, BadgeStatut, jourCourt, useFrequence, type InterventionVue, type RegleVue, type VueSalle } from "./commun";
import { RegleDialog } from "./RegleDialog";
import { SignalerForm } from "./SignalerForm";

// ============================================================
// Onglet « Entretien » d'une salle (maquette V1) : ce qui est en
// retard, ce qui est en cours, ce qui vient, ce qui n'a pas de date,
// les problèmes signalés, et les équipements de la salle avec leur
// plan d'entretien.
// ============================================================

type Filtre = "tout" | "retard" | "sansSuite" | "interventions";

export function EntretienSalle({ salleId, onCompte }: { salleId: string; onCompte?: (n: number) => void }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const freq = useFrequence();
  const { data, chargement, erreur, recharger } = useJson<VueSalle & { gestionnaire: boolean; moi: string }>(
    `/api/entretien/salles/${encodeURIComponent(salleId)}`
  );
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [ajouter, setAjouter] = useState<{ actifId?: string } | null>(null);
  const [signaler, setSignaler] = useState(false);
  const [modifier, setModifier] = useState<RegleVue | null>(null);

  const vue = useMemo(() => {
    if (!data) return null;
    const ouvertes = data.interventions.filter((iv) => !["validee", "annulee"].includes(iv.statut));
    const fermees = data.interventions.filter((iv) => ["validee", "annulee"].includes(iv.statut));
    const enRetard = data.regles.filter((r) => r.etatVue === "en_retard");
    const sansSuite = data.regles.filter((r) => r.etatVue === "a_planifier");
    const aVenir = data.regles.filter((r) => r.etatVue === "a_venir").sort((a, b) => (a.prochaine ?? "").localeCompare(b.prochaine ?? ""));
    const problemes = ouvertes.filter((iv) => iv.genre === "probleme");
    const enCours = ouvertes.filter((iv) => iv.genre === "preventif" && !enRetard.some((r) => r.interventionOuverte === iv.id));
    const sansEntretien = data.actifs.filter((a) => !a.dessert && a.regles === 0);
    return { ouvertes, fermees, enRetard, sansSuite, aVenir, problemes, enCours, sansEntretien };
  }, [data]);

  const compte = vue ? vue.enRetard.length + vue.problemes.length : null;
  useEffect(() => {
    if (compte != null && onCompte) onCompte(compte);
  }, [compte, onCompte]);

  if (erreur) return <p className="text-sm text-red-600">{erreur}</p>;
  if (!data || !vue) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
      </div>
    );
  }

  const peutSignaler = data.config.equipe || data.config.responsable;
  const retards = vue.enRetard.map((r) => r.retard).sort((a, b) => b - a);
  const montrer = (f: Filtre) => filtre === "tout" || filtre === f;
  const ouvrir = (id: string) => router.push(`/entretien/interventions/${encodeURIComponent(id)}`);

  return (
    <div className={`space-y-5 transition-opacity ${chargement ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        {(["tout", "retard", "sansSuite", "interventions"] as Filtre[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filtre === f ? "bg-chanv-terre text-white border-chanv-terre" : "border-chanv-fibre text-slate-600 bg-white"}`}
          >
            {t(`entretienSalle.filtre.${f}`)}{" "}
            {f === "tout" ? data.regles.length + vue.problemes.length : f === "retard" ? vue.enRetard.length : f === "sansSuite" ? vue.sansSuite.length : vue.ouvertes.length + vue.fermees.length}
          </button>
        ))}
        <span className="flex-1" />
        {peutSignaler ? (
          <button onClick={() => setSignaler(true)} className="btn-ghost text-xs border border-red-200 bg-red-50 text-red-700">
            <AlertTriangle className="w-4 h-4" /> {t("signaler.titre")}
          </button>
        ) : (
          <span className="text-[11px] text-slate-400" title={t("entretienSalle.equipeAChoisirAide")}>{t("entretienSalle.equipeAChoisir")}</span>
        )}
        {data.gestionnaire && (
          <button onClick={() => setAjouter({})} className="btn-primary text-xs">
            <Plus className="w-4 h-4" /> {t("regle.ajouterTitre")}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi titre={t("entretienSalle.kpi.retard")} valeur={String(vue.enRetard.length)} rouge={vue.enRetard.length > 0}
          sous={retards.length ? t("entretienSalle.kpi.retardDepuis", { liste: retards.slice(0, 3).join(", ") }) : t("entretienSalle.kpi.aucun")} />
        <Kpi titre={t("entretienSalle.kpi.sansDate")} valeur={String(vue.sansSuite.length)} sous={vue.sansSuite.map((r) => r.titre).slice(0, 2).join(", ") || "—"} />
        <Kpi
          titre={t("entretienSalle.kpi.sansEntretien")}
          valeur={t("entretienSalle.kpi.surN", { n: vue.sansEntretien.length, total: data.actifs.filter((a) => !a.dessert).length })}
          sous={vue.sansEntretien.map((a) => a.nom).slice(0, 3).join(", ") || "—"}
        />
        <Kpi titre={t("entretienSalle.kpi.derniere")} valeur={data.derniereValidee ? jourCourt(data.derniereValidee.slice(0, 10), locale) : t("entretienSalle.kpi.aucune")} sous={t("entretienSalle.kpi.auRegistre")} />
      </div>

      {montrer("retard") && vue.enRetard.length > 0 && (
        <Section titre={t("entretienSalle.enRetard")}>
          {vue.enRetard.map((r) => (
            <LigneRegle key={r.id} r={r} freq={freq} locale={locale} onOuvrir={r.interventionOuverte ? () => ouvrir(r.interventionOuverte!) : undefined} />
          ))}
        </Section>
      )}

      {(filtre === "tout" || filtre === "interventions") && vue.problemes.length > 0 && (
        <Section titre={t("entretienSalle.problemes")}>
          {vue.problemes.map((iv) => <LigneIntervention key={iv.id} iv={iv} locale={locale} onOuvrir={() => ouvrir(iv.id)} />)}
        </Section>
      )}

      {(filtre === "tout" || filtre === "interventions") && vue.enCours.length > 0 && (
        <Section titre={t("entretienSalle.enCours")}>
          {vue.enCours.map((iv) => <LigneIntervention key={iv.id} iv={iv} locale={locale} onOuvrir={() => ouvrir(iv.id)} />)}
        </Section>
      )}

      {filtre === "tout" && vue.aVenir.length > 0 && (
        <Section titre={t("entretienSalle.aVenir")}>
          {vue.aVenir.map((r) => <LigneRegle key={r.id} r={r} freq={freq} locale={locale} />)}
        </Section>
      )}

      {montrer("sansSuite") && vue.sansSuite.length > 0 && (
        <Section titre={t("entretienSalle.sansDate")}>
          {vue.sansSuite.map((r) => (
            <LigneRegle key={r.id} r={r} freq={freq} locale={locale} onModifier={data.gestionnaire ? () => setModifier(r) : undefined} />
          ))}
        </Section>
      )}

      {filtre === "interventions" && vue.fermees.length > 0 && (
        <Section titre={t("entretienSalle.fermees")}>
          {vue.fermees.map((iv) => <LigneIntervention key={iv.id} iv={iv} locale={locale} onOuvrir={() => ouvrir(iv.id)} />)}
        </Section>
      )}

      {data.regles.length === 0 && vue.problemes.length === 0 && filtre !== "interventions" && (
        <EmptyState icon="🛠️" title={t("entretienSalle.videTitre")} description={t("entretienSalle.videTexte")} />
      )}

      {filtre === "tout" && data.actifs.length > 0 && (
        <Section titre={t("entretienSalle.equipements")}>
          <div className="section-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-chanv-fibre text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2.5">{t("entretienSalle.colEquipement")}</th>
                  <th className="px-4 py-2.5">{t("entretienSalle.colCode")}</th>
                  <th className="px-4 py-2.5">{t("entretienSalle.colFiche")}</th>
                  <th className="px-4 py-2.5 text-right">{t("entretienSalle.colEntretiens")}</th>
                  <th className="px-4 py-2.5">{t("entretienSalle.colProchaine")}</th>
                </tr>
              </thead>
              <tbody>
                {data.actifs.map((a) => (
                  <tr key={a.id} className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20">
                    <td className="px-4 py-2.5">
                      <Link href={`/actifs/${encodeURIComponent(a.id)}`} className="font-medium text-chanv-terre hover:underline">{a.nom || a.id}</Link>
                      <div className="text-[11px] text-slate-400 font-mono">{a.matricule}{a.dessert ? ` · ${t("entretienSalle.dessert")}` : ""}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{a.idMasterlist || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.documents ? t("entretienSalle.ficheOui", { n: a.documents }) : "—"}</td>
                    <td className="px-4 py-2.5 text-right">{a.regles}</td>
                    <td className="px-4 py-2.5">
                      {a.enRetard ? (
                        <span className="badge text-[11px] bg-red-100 text-red-700">{t("entretienSalle.enRetardCourt")}</span>
                      ) : a.prochaine ? (
                        jourCourt(a.prochaine, locale)
                      ) : data.gestionnaire ? (
                        <button onClick={() => setAjouter({ actifId: a.id })} className="text-xs underline text-chanv-terre">{t("regle.ajouterTitre")}</button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {ajouter && (
        <RegleDialog
          mode="creer"
          initiale={ajouter.actifId && data.actifs.some((a) => a.id === ajouter.actifId) ? { actifIds: [ajouter.actifId] } : { salleIds: [salleId] }}
          onClose={() => setAjouter(null)}
          onSaved={() => {
            setAjouter(null);
            recharger();
          }}
        />
      )}
      {modifier && (
        <RegleDialog
          mode="modifier"
          regleId={modifier.id}
          initiale={modifier}
          onClose={() => setModifier(null)}
          onSaved={() => {
            setModifier(null);
            recharger();
          }}
        />
      )}
      {signaler && (
        <SignalerForm
          salleId={salleId}
          gestionnaire={data.gestionnaire}
          onClose={() => setSignaler(false)}
          onFait={(id) => {
            setSignaler(false);
            ouvrir(id);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ titre, valeur, sous, rouge = false }: { titre: string; valeur: string; sous: string; rouge?: boolean }) {
  return (
    <div className="section-card p-4 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{titre}</div>
      <div className={`text-lg font-bold mt-0.5 ${rouge ? "text-red-700" : "text-chanv-terre"}`}>{valeur}</div>
      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{sous}</div>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{titre}</h3>
      {children}
    </section>
  );
}

function LigneRegle({
  r,
  freq,
  locale,
  onOuvrir,
  onModifier,
}: {
  r: RegleVue;
  freq: (f: RegleVue["frequence"]) => string;
  locale: string;
  onOuvrir?: () => void;
  onModifier?: () => void;
}) {
  const t = useT();
  const Icone = r.etatVue === "en_retard" ? AlertTriangle : r.etatVue === "a_planifier" ? ClipboardList : CalendarClock;
  const ton = r.etatVue === "en_retard" ? "bg-red-100 text-red-700" : r.etatVue === "a_planifier" ? "bg-sky-100 text-sky-700" : "bg-chanv-fibre text-chanv-terre";
  return (
    <div className="section-card p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ton}`}>
        <Icone className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-chanv-terre">
          <strong>{r.titre}</strong>
          {r.equipements ? <> — {r.equipements}</> : null}
        </div>
        <div className="text-[12px] text-slate-500 mt-0.5">
          {[
            r.consigne ? `« ${r.consigne.slice(0, 120)} »` : null,
            r.quiNom || t("entretienSalle.personne"),
            freq(r.frequence),
            r.prochaine ? t("entretienSalle.prevueLe", { date: jourCourt(r.prochaine, locale) }) : null,
            r.origine?.source === "gmao" ? t("entretienSalle.sourceGmao") : r.origine?.source === "gandalf" ? t("entretienSalle.sourceGandalf", { refs: r.origine.refs.join(", ") }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        {r.etatVue === "a_venir" && r.ouvertureProchaine && (
          <div className="text-[11px] text-slate-400 mt-0.5">{t("entretienSalle.apparait", { date: jourCourt(r.ouvertureProchaine, locale) })}</div>
        )}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        {r.etatVue === "en_retard" && <BadgeRetard retard={r.retard} />}
        {r.etatVue === "a_planifier" && <span className="badge text-[11px] bg-sky-100 text-sky-700">{t("entretienSalle.aPlanifier")}</span>}
        {onOuvrir && (
          <button onClick={onOuvrir} className="btn-ghost text-xs border border-chanv-fibre">
            <Wrench className="w-3.5 h-3.5" /> {t("entretienSalle.ouvrir")}
          </button>
        )}
        {onModifier && (
          <button onClick={onModifier} className="text-xs underline text-chanv-terre">{t("entretienSalle.completer")}</button>
        )}
      </div>
    </div>
  );
}

function LigneIntervention({ iv, locale, onOuvrir }: { iv: InterventionVue; locale: string; onOuvrir: () => void }) {
  const t = useT();
  const Icone = iv.genre === "probleme" ? Flag : iv.statut === "validee" ? CheckCircle2 : Wrench;
  return (
    <button onClick={onOuvrir} className="section-card p-4 flex items-start gap-3 w-full text-left hover:bg-chanv-fibre/20">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iv.genre === "probleme" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
        <Icone className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-chanv-terre">
          <strong>{iv.genre === "probleme" ? `« ${iv.description.slice(0, 120)} »` : iv.titre}</strong>
          {iv.equipements ? <> — {iv.equipements}</> : null}
        </div>
        <div className="text-[12px] text-slate-500 mt-0.5">
          {[
            iv.genre === "probleme" && iv.priorite != null ? t("entretienSalle.priorite", { p: iv.priorite }) : null,
            iv.signalePar ? t("entretienSalle.signalePar", { nom: iv.signalePar.nom || iv.signalePar.email }) : null,
            iv.assignesNoms.length ? iv.assignesNoms.join(", ") : t("entretienSalle.personne"),
            iv.echeance ? t("entretienSalle.echeance", { date: jourCourt(iv.echeance, locale) }) : null,
            iv.photos.length ? t("ligne.photos", { n: iv.photos.length }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <BadgeStatut statut={iv.statut} />
        {iv.retard != null && iv.retard > 0 && <BadgeRetard retard={iv.retard} />}
      </div>
    </button>
  );
}
