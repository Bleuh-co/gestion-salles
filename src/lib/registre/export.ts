import "server-only";

import { getAllActifs } from "@/lib/repo/actifs";
import { getLocaux } from "@/lib/repo/locaux";
import { getPeriodes } from "@/lib/repo/rattachements";
import { translator, LANG_LOCALES, type Lang } from "@/lib/i18n-dict";
import { classeur, type Cellule, type Feuille } from "@/lib/xlsx";
import { auteurLigne, decrireLigne, nombre, plageTexte, type Formats } from "./libelles";
import { moyenneParPas, type Releve } from "./mesures";
import { actifsDeLaSalle, actifsPresentsA, chargerSalle, courbesDe, etatCapteurs, type DonneesSalle } from "./service";
import { heureDe, jourDe } from "./temps";

// ============================================================
// Export du registre (V6, V7, V10) : une ou plusieurs salles, une
// période, un contenu au choix. Le fichier sort dans la langue de
// la personne. La version imprimable (V8) lit les mêmes données.
// ============================================================

export type ModeMesures = "tous" | "heure" | "aucune";

export interface ContenuExport {
  journal: boolean;
  parJour: boolean;
  mesures: ModeMesures;
  actifs: boolean;
  capteurs: boolean;
}

export interface DemandeExport {
  salles: string[];
  periode?: string | null;
  du?: string | null;
  au?: string | null;
  contenu: ContenuExport;
  lang: Lang;
}

export const MAX_SALLES = 150;

export function lireDemande(sp: URLSearchParams, langDefaut: Lang): DemandeExport {
  const salles = (sp.get("salles") || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SALLES);
  const m = sp.get("mesures");
  const lang = sp.get("lang");
  return {
    salles,
    periode: sp.get("periode"),
    du: sp.get("du"),
    au: sp.get("au"),
    contenu: {
      journal: sp.get("journal") !== "0",
      parJour: sp.get("parJour") !== "0",
      mesures: m === "tous" || m === "aucune" ? m : "heure",
      actifs: sp.get("actifs") !== "0",
      capteurs: sp.get("capteurs") !== "0",
    },
    lang: lang === "en" || lang === "es" || lang === "fr" ? lang : langDefaut,
  };
}

export interface DonneesExport {
  demande: DemandeExport;
  salles: DonneesSalle[];
  noms: Record<string, string>;
  maintenant: number;
}

/** Charge les salles demandées (séquentiellement par petits lots pour ménager le fournisseur). */
export async function chargerExport(demande: DemandeExport): Promise<DonneesExport> {
  const maintenant = Date.now();
  const etat = await etatCapteurs();
  const locaux = await getLocaux({ includeArchived: true });
  const noms = Object.fromEntries(locaux.map((l) => [l.id, l.nomSalle]));
  const salles: DonneesSalle[] = [];
  for (let i = 0; i < demande.salles.length; i += 4) {
    const lot = await Promise.all(
      demande.salles.slice(i, i + 4).map((id) =>
        chargerSalle(id, {
          periode: demande.periode,
          du: demande.du,
          au: demande.au,
          mesures: true,
          lignes: true,
          maintenant,
          etat,
        })
      )
    );
    for (const d of lot) if (d) salles.push(d);
  }
  return { demande, salles, noms, maintenant };
}

/** Nombre de lignes de chaque contenu (V6 : la taille avant l'export). */
export function estimer(x: DonneesExport) {
  let releves = 0;
  let heures = 0;
  let jours = 0;
  let journal = 0;
  for (const d of x.salles) {
    journal += d.lignes.length;
    for (const s of d.series) {
      const rs = s.releves.filter((r) => s.fenetres.some((f) => r.t >= f.du && r.t < f.au));
      releves += rs.length;
      heures += moyenneParPas(rs, "c", 3600_000).length;
    }
    if (d.series.length) jours += courbesDe(d).parJour.length;
  }
  return { salles: x.salles.length, journal, jours, releves, heures };
}

function fmtJour(t: number): string {
  return jourDe(t);
}

function fmtInstant(t: number): string {
  return `${jourDe(t)} ${heureDe(t)}`;
}

const arrondi = (v: number | null | undefined, d: number) =>
  v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d;

/** Classeur Excel du registre (V7). */
export async function construireClasseur(x: DonneesExport, exportePar: string): Promise<Buffer> {
  const { demande, salles, noms, maintenant } = x;
  const t = translator(demande.lang);
  const f: Formats = { t, locale: LANG_LOCALES[demande.lang], noms };
  const feuilles: Feuille[] = [];
  const plusieurs = salles.length > 1;
  const b0 = salles[0]?.bornes;

  // Résumé
  if (!plusieurs && salles[0]) {
    const d = salles[0];
    const s = d.stats;
    const lignes: Cellule[][] = [
      [t("export.colSalle"), d.salle.id],
      [t("export.colNom"), d.salle.nomSalle],
      [t("salles.infoBuilding"), d.salle.batiment],
      [t("salles.infoFloor"), d.salle.etage],
      [t("salles.infoFamily"), d.salle.famille],
      [t("salles.infoLicenceId"), d.salle.idLicence],
      [t("salles.infoConditions"), d.salle.conditions],
      [t("plages.temperature"), plageTexte(d.plages.tempMin, d.plages.tempMax, "°C", f)],
      [t("plages.humidite"), plageTexte(d.plages.humMin, d.plages.humMax, "%", f)],
      [t("export.periode"), t("export.periodeDuAu", { du: d.bornes.duJour, au: d.bornes.auJour })],
      [t("export.exporteLe"), fmtInstant(maintenant)],
      [t("export.exportePar"), exportePar],
    ];
    if (s) {
      lignes.push(
        [t("export.relevesRecus"), s.recus],
        [t("export.relevesAttendus"), s.attendus],
        [t("export.tMin"), arrondi(s.c.min?.v, 2)],
        [t("export.tMinQuand"), s.c.min ? fmtInstant(s.c.min.t) : null],
        [t("export.tMax"), arrondi(s.c.max?.v, 2)],
        [t("export.tMaxQuand"), s.c.max ? fmtInstant(s.c.max.t) : null],
        [t("export.tMoy"), arrondi(s.c.moy, 2)],
        [t("export.hMin"), arrondi(s.h.min?.v, 1)],
        [t("export.hMax"), arrondi(s.h.max?.v, 1)],
        [t("export.hMoy"), arrondi(s.h.moy, 1)],
        [t("export.ecarts"), s.ecarts.length],
        [t("export.silences"), s.muets.length]
      );
    } else {
      lignes.push([t("export.mesures"), t("registre.sansCapteurCourt")]);
    }
    feuilles.push({ nom: t("export.ongletResume"), colonnes: [{ titre: t("export.colChamp"), largeur: 34 }, { titre: t("export.colValeur"), largeur: 50 }], lignes });
  } else {
    feuilles.push({
      nom: t("export.ongletResume"),
      colonnes: [
        { titre: t("export.colSalle"), largeur: 30 },
        { titre: t("export.colNom"), largeur: 28 },
        { titre: t("salles.infoFamily"), largeur: 18 },
        { titre: t("export.relevesRecus"), decimales: 0 },
        { titre: t("export.relevesAttendus"), decimales: 0 },
        { titre: t("export.tMin"), decimales: 2 },
        { titre: t("export.tMax"), decimales: 2 },
        { titre: t("export.tMoy"), decimales: 2 },
        { titre: t("export.hMin"), decimales: 1 },
        { titre: t("export.hMax"), decimales: 1 },
        { titre: t("export.hMoy"), decimales: 1 },
        { titre: t("export.ecarts"), decimales: 0 },
        { titre: t("export.silences"), decimales: 0 },
        { titre: t("export.lignesJournal"), decimales: 0 },
      ],
      lignes: [
        ...salles.map((d) => [
          d.salle.id,
          d.salle.nomSalle,
          d.salle.famille,
          d.stats?.recus ?? null,
          d.stats?.attendus ?? null,
          arrondi(d.stats?.c.min?.v, 2),
          arrondi(d.stats?.c.max?.v, 2),
          arrondi(d.stats?.c.moy, 2),
          arrondi(d.stats?.h.min?.v, 1),
          arrondi(d.stats?.h.max?.v, 1),
          arrondi(d.stats?.h.moy, 1),
          d.stats?.ecarts.length ?? null,
          d.stats?.muets.length ?? null,
          d.lignes.length,
        ]),
        [],
        [t("export.periode"), b0 ? t("export.periodeDuAu", { du: b0.duJour, au: b0.auJour }) : ""],
        [t("export.exporteLe"), fmtInstant(maintenant)],
        [t("export.exportePar"), exportePar],
      ],
    });
  }

  // Journal commun
  if (demande.contenu.journal) {
    const lignes = salles
      .flatMap((d) => d.lignes)
      .sort((a, b) => a.t - b.t)
      .map((l) => {
        const desc = decrireLigne(l, f);
        return [
          l.jourSeulement ? fmtJour(l.t) : fmtInstant(l.t),
          l.salleId ?? "",
          t(`sorte.${l.sorte}`),
          desc.titre,
          desc.detail,
          auteurLigne(l, t),
        ];
      });
    feuilles.push({
      nom: t("export.ongletJournal"),
      colonnes: [
        { titre: t("export.colQuand"), largeur: 17 },
        { titre: t("export.colSalle"), largeur: 26 },
        { titre: t("export.colSorte"), largeur: 12 },
        { titre: t("export.colLigne"), largeur: 70 },
        { titre: t("export.colDetail"), largeur: 60 },
        { titre: t("export.colPar"), largeur: 22 },
      ],
      lignes,
    });
  }

  // Par jour : une feuille par salle qui a un capteur
  if (demande.contenu.parJour) {
    for (const d of salles) {
      if (!d.series.length) continue;
      const rows = [...courbesDe(d).parJour].reverse().map((r) => [
        r.partiel && r.jour === jourDe(maintenant) ? `${r.jour} (${t("export.jusqua", { h: heureDe(maintenant) })})` : r.jour,
        r.recus,
        r.attendus,
        arrondi(r.cMin, 2),
        arrondi(r.cMax, 2),
        arrondi(r.cMoy, 2),
        arrondi(r.hMin, 1),
        arrondi(r.hMax, 1),
        arrondi(r.hMoy, 1),
        r.minutesHorsPlage,
      ]);
      feuilles.push({
        nom: plusieurs ? `${t("export.ongletParJour")} ${d.salle.id}` : t("export.ongletParJour"),
        colonnes: [
          { titre: t("export.colJour"), largeur: 26 },
          { titre: t("export.relevesRecus"), decimales: 0 },
          { titre: t("export.relevesAttendus"), decimales: 0 },
          { titre: t("export.tMin"), decimales: 2 },
          { titre: t("export.tMax"), decimales: 2 },
          { titre: t("export.tMoy"), decimales: 2 },
          { titre: t("export.hMin"), decimales: 1 },
          { titre: t("export.hMax"), decimales: 1 },
          { titre: t("export.hMoy"), decimales: 1 },
          { titre: t("export.minHorsPlage"), decimales: 0 },
        ],
        lignes: rows,
      });
    }
  }

  // Mesures
  if (demande.contenu.mesures !== "aucune") {
    const rows: Cellule[][] = [];
    for (const d of salles) {
      for (const s of d.series) {
        const rs: Releve[] = s.releves.filter((r) => s.fenetres.some((w) => r.t >= w.du && r.t < w.au));
        if (demande.contenu.mesures === "tous") {
          for (const r of rs) rows.push([fmtInstant(r.t), d.salle.id, s.nom, arrondi(r.c, 2), arrondi(r.h, 1)]);
        } else {
          const c = moyenneParPas(rs, "c", 3600_000);
          const h = new Map(moyenneParPas(rs, "h", 3600_000).map((p) => [p.t, p.v]));
          const n = new Map<number, number>();
          for (const r of rs) n.set(Math.floor(r.t / 3600_000) * 3600_000, (n.get(Math.floor(r.t / 3600_000) * 3600_000) ?? 0) + 1);
          for (const p of c) rows.push([fmtInstant(p.t), d.salle.id, s.nom, arrondi(p.v, 2), arrondi(h.get(p.t), 1), n.get(p.t) ?? null]);
        }
      }
    }
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const heure = demande.contenu.mesures === "heure";
    feuilles.push({
      nom: t("export.ongletMesures"),
      colonnes: [
        { titre: heure ? t("export.colHeure") : t("export.colQuand"), largeur: 17 },
        { titre: t("export.colSalle"), largeur: 26 },
        { titre: t("export.colCapteur"), largeur: 28 },
        { titre: heure ? t("export.tMoy") : t("export.colTemp"), decimales: 2 },
        { titre: heure ? t("export.hMoy") : t("export.colHum"), decimales: 1 },
        ...(heure ? [{ titre: t("export.colReleves"), decimales: 0 }] : []),
      ],
      lignes: rows,
    });
  }

  // Actifs : présents en fin de période, puis mouvements de la période
  if (demande.contenu.actifs) {
    const tous = await getAllActifs();
    const presents: Cellule[][] = [];
    for (const d of salles) {
      const fin = Math.min(d.bornes.au, maintenant);
      const liste = await actifsPresentsA(d.salle.id, fin >= maintenant - 60_000 ? maintenant + 1 : fin);
      const depuis = new Map((await actifsDeLaSalle(d.salle.id, tous.filter((a) => a.idSalle === d.salle.id))).map((x) => [x.actif.id, x]));
      for (const a of liste) {
        const x = depuis.get(a.id);
        presents.push([
          d.salle.id,
          a.matricule,
          a.nom,
          a.statut,
          a.criticite ?? "",
          x?.depuis ? `${fmtJour(x.depuis)} (${t(`actifsSalle.origine.${x.origine}`)})` : "",
        ]);
      }
    }
    feuilles.push({
      nom: t("export.ongletActifs"),
      colonnes: [
        { titre: t("export.colSalle"), largeur: 26 },
        { titre: t("actifForm.matricule"), largeur: 16 },
        { titre: t("export.colActif"), largeur: 40 },
        { titre: t("actifs.colStatus"), largeur: 16 },
        { titre: t("actifs.colCriticality"), largeur: 12 },
        { titre: t("actifsSalle.colDepuis"), largeur: 30 },
      ],
      lignes: presents,
    });
    // Actifs et items agricoles (lot 6 : le SKU dans la colonne du matricule).
    const mouvements = salles
      .flatMap((d) => d.lignes.filter((l) => (l.sorte === "actif" || l.sorte === "item") && l.type !== "ouverture"))
      .sort((a, b) => a.t - b.t)
      .map((l) => {
        const desc = decrireLigne(l, f);
        return [
          l.jourSeulement ? fmtJour(l.t) : fmtInstant(l.t),
          l.salleId ?? "",
          l.cible?.matricule ?? "",
          l.cible?.nom ?? "",
          desc.titre,
          l.autreSalle ?? "",
          l.motif ? t(`motif.${l.motif}`) : "",
          auteurLigne(l, t),
        ];
      });
    feuilles.push({
      nom: t("export.ongletMouvements"),
      colonnes: [
        { titre: t("export.colQuand"), largeur: 17 },
        { titre: t("export.colSalle"), largeur: 26 },
        { titre: t("actifForm.matricule"), largeur: 16 },
        { titre: t("export.colActif"), largeur: 36 },
        { titre: t("export.colLigne"), largeur: 60 },
        { titre: t("export.colAutreSalle"), largeur: 24 },
        { titre: t("export.colMotif"), largeur: 18 },
        { titre: t("export.colPar"), largeur: 22 },
      ],
      lignes: mouvements,
    });
  }

  // Capteurs et rattachements datés
  if (demande.contenu.capteurs) {
    const periodes = await getPeriodes();
    const choisies = new Set(salles.map((d) => d.salle.id));
    const rows = periodes
      .filter((p) => p.salleId && choisies.has(p.salleId))
      .sort((a, b) => (a.salleId! < b.salleId! ? -1 : a.salleId! > b.salleId! ? 1 : a.du - b.du))
      .map((p) => {
        const d = salles.find((x) => x.salle.id === p.salleId);
        const s = d?.series.find((x) => x.sensorId === p.sensorId);
        const n = s ? s.releves.filter((r) => r.t >= p.du && r.t < (p.au ?? Infinity) && s.fenetres.some((w) => r.t >= w.du && r.t < w.au)).length : 0;
        return [
          p.salleId,
          p.sensorName,
          fmtInstant(p.du),
          p.au ? fmtInstant(p.au) : t("export.aujourdhui"),
          p.confirme ? t("salles.yes") : t("export.aConfirmer"),
          p.parNom || p.par || t(`origine.${p.source}`),
          n,
        ];
      });
    feuilles.push({
      nom: t("export.ongletCapteurs"),
      colonnes: [
        { titre: t("export.colSalle"), largeur: 26 },
        { titre: t("export.colCapteur"), largeur: 30 },
        { titre: t("export.colDu"), largeur: 17 },
        { titre: t("export.colAu"), largeur: 17 },
        { titre: t("export.colConfirme"), largeur: 14 },
        { titre: t("export.colRattachePar"), largeur: 24 },
        { titre: t("export.colRelevesPeriode"), decimales: 0 },
      ],
      lignes: rows,
    });
  }

  return classeur(feuilles);
}

/** Nom du fichier : « Registre ZONE MULTI 5 — 2026-09-06 au 2026-10-06.xlsx ». */
export function nomFichier(x: DonneesExport, extension: string): string {
  const t = translator(x.demande.lang);
  const b = x.salles[0]?.bornes;
  const qui = x.salles.length === 1 ? x.salles[0].salle.id : t("export.nSalles", { n: x.salles.length });
  const periode = b ? t("export.periodeDuAu", { du: b.duJour, au: b.auJour }) : "";
  return `${t("export.registre")} ${qui} — ${periode}.${extension}`.replace(/[\x00-\x1f\\/:*?"<>|#]+/g, " ");
}

/** Texte des plages pour l'en-tête imprimable. */
export function plagesTexte(d: DonneesSalle, f: Formats): string {
  const c = plageTexte(d.plages.tempMin, d.plages.tempMax, "°C", f);
  const h = plageTexte(d.plages.humMin, d.plages.humMax, "%", f);
  return `${f.t("plages.temperature")} : ${c} · ${f.t("plages.humidite")} : ${h}`;
}

export { nombre };
