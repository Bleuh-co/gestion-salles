import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getServerLang } from "@/lib/i18n-server";
import { LANG_LOCALES, translator } from "@/lib/i18n-dict";
import { nomPersonne } from "@/lib/repo/personnes";
import { dateLongue, heure } from "@/lib/registre/libelles";
import { frequenceTexte } from "@/lib/entretien/textes";
import { vueActif } from "@/lib/entretien/vues";
import { BoutonImprimer } from "../../../registre/imprimer/BoutonImprimer";

// ============================================================
// Fiche de vie d'un équipement (maquette V12), à imprimer pour un
// audit qualité : identité, photos, plan d'entretien, interventions
// et leurs preuves, et une case « Revu par ». C'est ce que demandent
// les onglets calibration / PM / PV et validation des fiches qualité.
// ============================================================

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ actifId: string }>;
}

export default async function FicheDeVie({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { actifId } = await params;
  const vue = await vueActif(decodeURIComponent(actifId));
  if (!vue) notFound();
  const lang = await getServerLang();
  const t = translator(lang);
  const locale = LANG_LOCALES[lang];
  const a = vue.actif;
  const maintenant = Date.now();
  const par = session.displayName || (await nomPersonne(session.email));
  const jour = (j: string | null | undefined) => (j ? dateLongue(Date.parse(`${j.slice(0, 10)}T12:00:00Z`), locale) : "—");
  const interventions = [...vue.interventions].sort((x, y) => (y.termineA || y.creeA).localeCompare(x.termineA || x.creeA));

  return (
    <div className="registre-imprimable" lang={lang}>
      <style>{CSS}</style>
      <BoutonImprimer libelle={t("imprimer.imprimer")} aide={t("imprimer.aide")} />
      <section className="feuille">
        <div className="entete">{t("ficheVie.entete")}</div>
        <h1>{a.nom || a.id}{a.matricule ? ` — ${a.matricule}` : ""}</h1>
        <table className="chiffres">
          <tbody>
            <tr>
              <th>{t("actif.fabricant")}</th><td>{[a.marque, a.modele].filter(Boolean).join(" ") || "—"}</td>
              <th>{t("actif.serie")}</th><td>{a.numSerie || "—"}</td>
            </tr>
            <tr>
              <th>{t("regle.salle")}</th><td>{a.idSalle ? `${vue.salleNom ? `${vue.salleNom} ` : ""}(${a.idSalle})` : "—"}</td>
              <th>{t("actif.installe")}</th><td>{a.dateInstall || "—"}</td>
            </tr>
            <tr>
              <th>{t("regle.criticite")}</th><td>{a.criticite || "—"}</td>
              <th>{t("actifs.colCategory")}</th><td>{a.categorie || "—"}</td>
            </tr>
            <tr>
              <th>{t("actifs.colStatus")}</th><td>{a.statut || "—"}</td>
              <th>{t("actif.fiche")}</th><td>{vue.documents.map((d) => d.nom).join(", ") || a.idMasterlist || "—"}</td>
            </tr>
          </tbody>
        </table>

        {vue.photos.length > 0 && (
          <div className="photos">
            {vue.photos.slice(0, 4).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.lien} src={p.lien} alt={p.nom} />
            ))}
          </div>
        )}

        <h2>{t("ficheVie.plan")}</h2>
        {vue.regles.length ? (
          <table className="liste">
            <thead>
              <tr><th>{t("ficheVie.entretien")}</th><th>{t("ficheVie.par")}</th><th>{t("regle.frequence")}</th><th>{t("regle.prochaine")}</th><th>{t("regle.preuve")}</th></tr>
            </thead>
            <tbody>
              {vue.regles.map((r) => (
                <tr key={r.id}>
                  <td>{r.titre}{r.consigne ? <div className="detail">{r.consigne}</div> : null}</td>
                  <td>{r.quiNom || "—"}</td>
                  <td>{frequenceTexte(r, t)}</td>
                  <td className="quand">{jour(r.prochaine)}</td>
                  <td>{t(`regle.preuve.${r.preuve}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="note">{t("actif.aucunEntretien")}</p>
        )}

        <h2>{t("ficheVie.interventions")}</h2>
        {interventions.length ? (
          <table className="liste">
            <thead>
              <tr><th>{t("ficheVie.date")}</th><th>{t("ficheVie.intervention")}</th><th>{t("ficheVie.preuve")}</th><th>{t("ficheVie.faitePar")}</th><th>{t("ficheVie.validee")}</th></tr>
            </thead>
            <tbody>
              {interventions.map((iv) => (
                <tr key={iv.id}>
                  <td className="quand">{jour(iv.termineA || iv.annuleA || iv.creeA)}</td>
                  <td>
                    {iv.genre === "probleme" ? `${t("intervention.probleme")} : ${iv.description}` : iv.titre}
                    <div className="detail">
                      {[iv.echeance ? t("entretienSalle.prevueLe", { date: jour(iv.echeance) }) : null, t(`entretien.statut.${iv.statut}`), iv.motif ? `${t("intervention.motif")} : ${iv.motif}` : null, iv.noteFin ? `« ${iv.noteFin} »` : null].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td>{[...iv.preuves.map((p) => p.nom), iv.mesure ? `${iv.mesure} ${iv.mesureUnite}` : ""].filter(Boolean).join(", ") || "—"}</td>
                  <td>{iv.terminePar?.nom || iv.terminePar?.email || "—"}</td>
                  <td>{iv.valideA ? `${jour(iv.valideA)}, ${iv.validePar?.nom || ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="note">{t("ficheVie.aucuneIntervention")}</p>
        )}

        <div className="revision">
          <div><span>{t("imprimer.revuPar")}</span></div>
          <div><span>{t("imprimer.date")}</span></div>
          <div><span>{t("imprimer.signature")}</span></div>
        </div>
        <div className="pied">{t("ficheVie.pied", { date: dateLongue(maintenant, locale), heure: heure(maintenant, locale), nom: par })}</div>
      </section>
    </div>
  );
}

const CSS = `
html, body { background: #fff !important; background-image: none !important; }
.registre-imprimable { color: #282828; font-family: var(--font-inter), system-ui, sans-serif; font-size: 12px; }
.registre-outils { max-width: 8.5in; margin: 20px auto 0; padding: 10px 14px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
  border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.registre-outils button { display: inline-flex; gap: 8px; align-items: center; font-size: 14px; font-weight: 600; padding: 8px 16px;
  border: 0; border-radius: 8px; background: #1a1a1a; color: #fff; cursor: pointer; }
.registre-outils span { font-size: 12px; color: #64748b; }
.feuille { max-width: 8.5in; margin: 16px auto; padding: 0.55in 0.6in; background: #fff; border: 1px solid #e5e7eb; }
.entete { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #8a7648; font-weight: 700; }
.feuille h1 { font-size: 20px; margin: 4px 0 10px; }
.feuille h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #f1eada; }
.note { color: #475569; }
table.chiffres { width: 100%; border-collapse: collapse; }
table.chiffres th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; width: 17%; padding: 6px 8px; background: #f8f5ee; border: 1px solid #f1eada; }
table.chiffres td { padding: 6px 8px; border: 1px solid #f1eada; }
table.liste { width: 100%; border-collapse: collapse; }
table.liste th { text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; padding: 4px 6px; border-bottom: 1px solid #ddcba4; }
table.liste td { padding: 4px 6px; border-bottom: 1px solid #f1eada; vertical-align: top; }
table.liste td.quand { white-space: nowrap; color: #475569; }
.detail { color: #64748b; font-size: 11px; }
.photos { display: flex; gap: 10px; margin-top: 12px; }
.photos img { height: 140px; width: auto; border-radius: 6px; border: 1px solid #e5e7eb; object-fit: cover; }
.revision { display: grid; grid-template-columns: 2fr 1fr 2fr; gap: 10px; margin-top: 22px; }
.revision div { border: 1px solid #94a3b8; border-radius: 6px; height: 58px; padding: 4px 8px; }
.revision span { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.pied { margin-top: 18px; font-size: 10px; color: #94a3b8; }
@page { size: letter; margin: 12mm; }
@media print {
  .registre-outils { display: none !important; }
  .feuille { border: 0; margin: 0; padding: 0; max-width: none; }
  tr, .revision, table.chiffres, .photos { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;
