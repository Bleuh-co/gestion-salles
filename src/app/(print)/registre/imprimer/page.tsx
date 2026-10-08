import { createHash } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getServerLang } from "@/lib/i18n-server";
import { LANG_LOCALES, translator } from "@/lib/i18n-dict";
import { inscrire } from "@/lib/repo/registre";
import { chargerExport, lireDemande, plagesTexte } from "@/lib/registre/export";
import { actifsPresentsA, courbesDe, type DonneesSalle } from "@/lib/registre/service";
import { auteurLigne, dateCourte, dateHeure, dateLongue, decrireLigne, duree, heure, nombre, type Formats } from "@/lib/registre/libelles";
import { parJour, type Releve } from "@/lib/registre/mesures";
import { jourDe } from "@/lib/registre/temps";
import { auteurDe } from "@/lib/registre/routes";
import { CourbeSvg } from "@/components/registre/CourbeSvg";
import { BoutonImprimer } from "./BoutonImprimer";
import { entretienDesSalles, type EntretienExport } from "@/lib/entretien/export";

// ============================================================
// Version imprimable du registre (V8) : une page qu'on peut classer
// ou montrer lors d'une inspection — la salle, la période, qui a
// exporté, les chiffres, la courbe, le journal, les actifs présents
// et une case « Revu par ». Le PDF sort de l'impression du navigateur,
// comme les affiches QR. Une section par salle.
// ============================================================

export const dynamic = "force-dynamic";

/** Couleurs fixes à l'impression (pas de mode sombre sur papier). */
const ROUGE = "#e34948";

export async function generateMetadata() {
  const t = translator(await getServerLang());
  return { title: t("imprimer.metaTitre") };
}

export default async function ImprimerRegistre({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const brut = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(brut)) if (typeof v === "string") sp.set(k, v);
  const demande = lireDemande(sp, await getServerLang());
  const admin = session.role === "admin" || session.role === "superadmin";
  if (!demande.salles.length) notFound();
  if (!admin) demande.salles = demande.salles.slice(0, 10);

  const x = await chargerExport(demande);
  if (!x.salles.length) notFound();
  const t = translator(demande.lang);
  const locale = LANG_LOCALES[demande.lang];
  const f: Formats = { t, locale, noms: x.noms };
  const par = await auteurDe(session);
  const b = x.salles[0].bornes;

  // Chaque export s'inscrit au registre ; recharger la page ne double pas la ligne (10 min).
  const tranche = Math.floor(x.maintenant / 600_000);
  const cle = createHash("sha1")
    .update([par.email, demande.salles.join("|"), b.duJour, b.auJour, demande.lang, tranche].join("\n"))
    .digest("hex")
    .slice(0, 20);
  await inscrire(
    x.salles.map((d) => ({
      id: `export_pdf_${cle}`,
      salleId: d.salle.id,
      action: "registre_exporte" as const,
      par,
      details: { du: b.duJour, au: b.auJour, format: "pdf", salles: x.salles.length, lang: demande.lang },
    }))
  );

  const sections = await Promise.all(
    x.salles.map(async (d) => ({
      d,
      actifs: await actifsPresentsA(d.salle.id, Math.min(d.bornes.au, x.maintenant) >= x.maintenant - 60_000 ? x.maintenant + 1 : d.bornes.au),
      entretien: await entretienDesSalles([d.salle.id], d.bornes.du, Math.min(d.bornes.au, x.maintenant + 1)).catch(() => null),
    }))
  );

  return (
    <div className="registre-imprimable" lang={demande.lang}>
      <style>{CSS}</style>
      <BoutonImprimer libelle={t("imprimer.imprimer")} aide={t("imprimer.aide")} />
      {sections.map(({ d, actifs, entretien }) => (
        <Section key={d.salle.id} d={d} actifs={actifs} entretien={entretien} f={f} parNom={par.nom || par.email} maintenant={x.maintenant} />
      ))}
    </div>
  );
}

function Section({
  d,
  actifs,
  entretien,
  f,
  parNom,
  maintenant,
}: {
  d: DonneesSalle;
  actifs: { id: string; matricule: string; nom: string; statut: string }[];
  entretien: EntretienExport | null;
  f: Formats;
  parNom: string;
  maintenant: number;
}) {
  const { t, locale } = f;
  const s = d.stats;
  const fin = Math.min(d.bornes.au, maintenant);
  const tous: Releve[] = d.series.flatMap((x) => x.releves.filter((r) => x.fenetres.some((w) => r.t >= w.du && r.t < w.au)));
  const jours = parJour(tous, "c");
  const resume = d.series.length ? [...courbesDe(d).parJour].reverse() : [];
  const journal = d.lignes.filter((l) => l.sorte !== "export").sort((a, b) => a.t - b.t);
  const capteursEnPlace = d.capteurs.filter((c) => c.depuis != null);
  const pied = `${t("export.registre")} ${d.salle.id} · ${t("export.periodeDuAu", { du: d.bornes.duJour, au: d.bornes.auJour })}`;

  return (
    <section className="feuille">
      <div className="entete">{t("imprimer.entete")}</div>
      <h1>
        {d.salle.id}
        {d.salle.nomSalle && ` — ${d.salle.nomSalle}`}
      </h1>
      <p className="infos">
        {[d.salle.batiment, d.salle.etage, `${t("salles.infoFamily")} ${d.salle.famille}`, `${t("salles.infoLicenceId")} ${d.salle.idLicence}`]
          .filter(Boolean)
          .join(" · ")}
        {d.salle.conditions && ` · ${t("salles.infoConditions")} : ${d.salle.conditions}`}
        <br />
        {plagesTexte(d, f)}
      </p>
      <p className="infos">
        {t("imprimer.periode", {
          du: dateLongue(d.bornes.du, locale),
          au: `${dateLongue(fin, locale)}, ${heure(fin, locale)}`,
        })}
        <br />
        {t("imprimer.exporte", { date: dateLongue(maintenant, locale), heure: heure(maintenant, locale), nom: parNom })}
      </p>

      {s ? (
        <table className="chiffres">
          <tbody>
            <tr>
              <th>{t("export.relevesRecus")}</th>
              <td>
                {t("imprimer.recusSur", { recus: nombre(s.recus, locale, 0), attendus: nombre(s.attendus, locale, 0) })}
                {s.muets.length
                  ? ` · ${t("registre.silences", { n: s.muets.length, duree: duree(s.muets.reduce((a, m) => a + (m.fin - m.debut), 0) / 60_000, t) })}`
                  : ` · ${t("imprimer.aucunSilence")}`}
              </td>
              <th>{t("registre.ecartsPlage")}</th>
              <td>{d.plages.tempMin != null || d.plages.tempMax != null || d.plages.humMin != null || d.plages.humMax != null ? (s.ecarts.length || t("registre.aucun")) : t("registre.aucunePlage")}</td>
            </tr>
            <tr>
              <th>{t("tabs.temperature")}</th>
              <td>
                {s.c.min && s.c.max
                  ? t("imprimer.temperature", {
                      min: nombre(s.c.min.v, locale),
                      quandMin: dateHeure(s.c.min.t, locale),
                      max: nombre(s.c.max.v, locale),
                      quandMax: dateHeure(s.c.max.t, locale),
                      moy: nombre(s.c.moy, locale, 2),
                    })
                  : "—"}
              </td>
              <th>{t("tabs.humidity")}</th>
              <td>
                {s.h.min && s.h.max
                  ? t("imprimer.humidite", { min: nombre(s.h.min.v, locale), max: nombre(s.h.max.v, locale), moy: nombre(s.h.moy, locale) })
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="note">{d.aEuCapteur ? t("registre.aucuneMesurePeriode") : t("registre.sansCapteurCourt")}</p>
      )}

      {jours.length > 1 && (
        <>
          <h2>{t("imprimer.courbe")}</h2>
          <CourbeSvg
            du={d.bornes.du}
            au={fin}
            unite="°C"
            locale={locale}
            hauteur={190}
            titre={t("imprimer.courbe")}
            plage={{ min: d.plages.tempMin, max: d.plages.tempMax }}
            series={[
              {
                nom: t("tabs.temperature"),
                couleur: ROUGE,
                points: jours.map((j) => ({ t: j.t + 12 * 3600_000, v: j.moy })),
                bande: jours.map((j) => ({ t: j.t + 12 * 3600_000, min: j.min, max: j.max })),
                opaciteBande: 0.2,
              },
            ]}
          />
        </>
      )}

      <h2>{t("imprimer.journal")}</h2>
      {journal.length ? (
        <table className="liste">
          <tbody>
            {journal.map((l) => {
              const x = decrireLigne(l, f);
              return (
                <tr key={l.id}>
                  <td className="quand">{l.jourSeulement ? dateCourte(l.t, locale) : dateHeure(l.t, locale)}</td>
                  <td>
                    {x.titre}
                    {x.detail && <div className="detail">{x.detail}</div>}
                  </td>
                  <td className="qui">{auteurLigne(l, t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="note">
          {t("imprimer.journalVide")}
          {capteursEnPlace.map((c) => ` ${t("imprimer.capteurEnPlace", { nom: c.nom, date: dateLongue(c.depuis!, locale) })}`).join("")}
        </p>
      )}

      <h2>{t("imprimer.actifsPresents", { date: dateLongue(fin, locale) })}</h2>
      {actifs.length ? (
        <table className="liste">
          <thead>
            <tr>
              <th>{t("actifForm.matricule")}</th>
              <th>{t("export.colActif")}</th>
              <th>{t("actifs.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {actifs.map((a) => (
              <tr key={a.id}>
                <td className="quand">{a.matricule}</td>
                <td>{a.nom}</td>
                <td className="qui">{a.statut}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="note">{t("ligne.ouvertureAucunActif")}</p>
      )}

      {entretien && (entretien.regles.length > 0 || entretien.interventions.length > 0) && (
        <>
          <h2>{t("imprimer.entretien")}</h2>
          {entretien.interventions.length > 0 ? (
            <table className="liste">
              <thead>
                <tr>
                  <th>{t("export.colFaitLe")}</th>
                  <th>{t("export.colIntervention")}</th>
                  <th>{t("export.colStatut")}</th>
                  <th>{t("export.colPreuves")}</th>
                </tr>
              </thead>
              <tbody>
                {entretien.interventions.map(({ iv, equipements }) => (
                  <tr key={iv.id}>
                    <td className="quand">{iv.termineA ? dateCourte(Date.parse(iv.termineA), locale) : iv.echeance ? `${t("export.colEcheance")} ${iv.echeance}` : "—"}</td>
                    <td>
                      {iv.genre === "probleme" ? iv.description : iv.titre}
                      <div className="detail">{[equipements, iv.terminePar?.nom, iv.validePar ? t("imprimer.validePar", { nom: iv.validePar.nom }) : null, iv.motif || null].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="qui">{t(`entretien.statut.${iv.statut}`)}</td>
                    <td>{[...iv.preuves.map((p) => p.nom), iv.mesure ? `${iv.mesure} ${iv.mesureUnite}` : ""].filter(Boolean).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note">{t("imprimer.aucuneIntervention")}</p>
          )}
          {entretien.regles.length > 0 && (
            <p className="note">
              {t("imprimer.planEntretien")} :{" "}
              {entretien.regles.map((r) => `${r.regle.titre}${r.equipements ? ` (${r.equipements})` : ""}${r.regle.prochaine ? `, ${t("regle.prochaine").toLowerCase()} ${r.regle.prochaine}` : ""}`).join(" ; ")}
            </p>
          )}
        </>
      )}

      <div className="revision">
        <div>
          <span>{t("imprimer.revuPar")}</span>
        </div>
        <div>
          <span>{t("imprimer.date")}</span>
        </div>
        <div>
          <span>{t("imprimer.signature")}</span>
        </div>
      </div>

      {resume.length > 0 && (
        <div className="suite">
          <h2>{t("capteurs.resumeParJour")}</h2>
          <table className="liste nombres">
            <thead>
              <tr>
                <th>{t("export.colJour")}</th>
                <th>{t("export.relevesRecus")}</th>
                <th>{t("export.relevesAttendus")}</th>
                <th>{t("export.tMin")}</th>
                <th>{t("export.tMax")}</th>
                <th>{t("export.tMoy")}</th>
                <th>{t("export.hMin")}</th>
                <th>{t("export.hMax")}</th>
                <th>{t("export.minHorsPlage")}</th>
              </tr>
            </thead>
            <tbody>
              {resume.map((r) => (
                <tr key={r.jour}>
                  <td className="quand">
                    {r.jour}
                    {r.jour === jourDe(maintenant) && ` (${t("export.jusqua", { h: heure(maintenant, locale) })})`}
                  </td>
                  <td>{r.recus}</td>
                  <td>{r.attendus}</td>
                  <td>{nombre(r.cMin, locale, 2, true)}</td>
                  <td>{nombre(r.cMax, locale, 2, true)}</td>
                  <td>{nombre(r.cMoy, locale, 2, true)}</td>
                  <td>{nombre(r.hMin, locale, 1, true)}</td>
                  <td>{nombre(r.hMax, locale, 1, true)}</td>
                  <td>{r.minutesHorsPlage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pied">{pied}</div>
    </section>
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
.feuille { max-width: 8.5in; margin: 16px auto; padding: 0.55in 0.6in; background: #fff; border: 1px solid #e5e7eb; position: relative; }
.entete { font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #8a7648; font-weight: 700; }
.feuille h1 { font-size: 22px; margin: 4px 0 6px; color: #282828; }
.feuille h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #f1eada; color: #282828; }
.infos { color: #475569; margin: 2px 0 6px; line-height: 1.5; }
.note { color: #475569; }
table.chiffres { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.chiffres th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; width: 16%; padding: 6px 8px; background: #f8f5ee; }
table.chiffres td { padding: 6px 8px; border-bottom: 1px solid #f1eada; }
table.liste { width: 100%; border-collapse: collapse; }
table.liste th { text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; padding: 4px 6px; border-bottom: 1px solid #ddcba4; }
table.liste td { padding: 4px 6px; border-bottom: 1px solid #f1eada; vertical-align: top; }
table.liste td.quand { white-space: nowrap; color: #475569; width: 1%; }
table.liste td.qui { white-space: nowrap; color: #64748b; width: 1%; }
table.nombres td { font-variant-numeric: tabular-nums; }
.detail { color: #64748b; font-size: 11px; }
.revision { display: grid; grid-template-columns: 2fr 1fr 2fr; gap: 10px; margin-top: 22px; }
.revision div { border: 1px solid #94a3b8; border-radius: 6px; height: 58px; padding: 4px 8px; }
.revision span { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; }
.suite { break-before: page; page-break-before: always; }
.pied { margin-top: 18px; font-size: 10px; color: #94a3b8; }
.feuille svg text { fill: #64748b; }
@page { size: letter; margin: 12mm; }
@media print {
  .registre-outils { display: none !important; }
  .feuille { border: 0; margin: 0; padding: 0; max-width: none; break-after: page; page-break-after: always; }
  .feuille:last-child { break-after: auto; page-break-after: auto; }
  tr, .revision, table.chiffres { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;
