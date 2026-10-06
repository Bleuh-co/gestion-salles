// ============================================================
// Textes des lignes du registre, dans la langue de la personne.
// Une seule source pour l'écran, le fichier Excel et la version
// imprimable (module pur : reçoit la fonction de traduction).
// ============================================================

import { FUSEAU } from "./temps.ts";
import type { LigneRegistre } from "./types.ts";

export type T = (key: string, vars?: Record<string, string | number>) => string;

export interface Formats {
  t: T;
  locale: string;
  /** Code de salle → nom (pour « déplacé vers ZONE MULTI 4 · Salle pouponnière »). */
  noms?: Record<string, string>;
}

export function nombre(v: number | null | undefined, locale: string, decimales = 1): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: decimales, minimumFractionDigits: 0 }).format(v);
}

export function dateCourte(t: number, locale: string, annee = true): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: FUSEAU,
    day: "numeric",
    month: "short",
    ...(annee ? { year: "numeric" } : {}),
  }).format(new Date(t));
}

export function dateLongue(t: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: FUSEAU, day: "numeric", month: "long", year: "numeric" }).format(
    new Date(t)
  );
}

export function heure(t: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit" }).format(new Date(t));
}

export function dateHeure(t: number, locale: string): string {
  return `${dateCourte(t, locale)} ${heure(t, locale)}`;
}

/** « 40 min », « 6 h 30 min », « 2 j 4 h ». */
export function duree(minutes: number, t: T): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return t("duree.minutes", { n: m });
  const h = Math.floor(m / 60);
  if (h < 48) return m % 60 ? t("duree.heuresMinutes", { h, m: m % 60 }) : t("duree.heures", { h });
  const j = Math.floor(h / 24);
  return h % 24 ? t("duree.joursHeures", { j, h: h % 24 }) : t("duree.jours", { j });
}

export function salleTexte(id: string | null | undefined, f: Formats): string {
  if (!id) return f.t("registre.salleInconnue");
  const nom = f.noms?.[id];
  return nom ? `${id} · ${nom}` : id;
}

function actifTexte(l: LigneRegistre): string {
  const c = l.cible;
  if (!c) return "";
  return c.matricule ? `${c.nom} (${c.matricule})` : c.nom;
}

const CHAMPS_PLAGE = new Set(["plageTempMin", "plageTempMax", "plageHumMin", "plageHumMax", "plageSeuil"]);

/** Valeur d'un champ, lisible (statut, oui/non, vide). */
function valeurChamp(champ: string, v: string, f: Formats): string {
  if (v === "") return "—";
  if (champ === "prod") return v === "true" ? f.t("salles.yes") : v === "false" ? f.t("salles.no") : v;
  if (champ === "statut") {
    const k = `status.${v}`;
    const tr = f.t(k);
    return tr === k ? v : tr;
  }
  if (CHAMPS_PLAGE.has(champ) && champ !== "plageSeuil") {
    const n = Number(v);
    return Number.isFinite(n) ? nombre(n, f.locale) : v;
  }
  return v;
}

export function changementsTexte(changes: LigneRegistre["changes"], f: Formats): string {
  if (!changes) return "";
  return Object.entries(changes)
    .map(([champ, { before, after }]) => {
      const k = `champ.${champ}`;
      const nom = f.t(k) === k ? champ : f.t(k);
      return `${nom} : ${valeurChamp(champ, before, f)} → ${valeurChamp(champ, after, f)}`;
    })
    .join(" ; ");
}

export function plageTexte(min: number | null | undefined, max: number | null | undefined, unite: string, f: Formats): string {
  if (min == null && max == null) return f.t("plages.nonSuivie");
  if (min != null && max != null) return f.t("plages.de", { min: nombre(min, f.locale), max: nombre(max, f.locale), u: unite });
  if (min != null) return f.t("plages.auMoins", { min: nombre(min, f.locale), u: unite });
  return f.t("plages.auPlus", { max: nombre(max!, f.locale), u: unite });
}

export interface Description {
  titre: string;
  detail: string;
}

/** Titre et détail d'une ligne du registre. */
export function decrireLigne(l: LigneRegistre, f: Formats): Description {
  const { t } = f;
  const d = (l.details ?? {}) as Record<string, unknown>;
  const detail: string[] = [];
  let titre = "";
  switch (l.type) {
    case "ouverture": {
      titre = d.repriseSheet ? t("ligne.ouvertureSheet") : t("ligne.ouverture");
      const actifs = (d.actifs as { nom: string; matricule: string }[] | undefined) ?? [];
      detail.push(
        actifs.length
          ? t("ligne.ouvertureActifs", { n: actifs.length, liste: actifs.map((a) => a.nom || a.matricule).join(", ") })
          : t("ligne.ouvertureAucunActif")
      );
      const dessert = (d.dessert as { nom: string }[] | undefined) ?? [];
      if (dessert.length) detail.push(t("ligne.ouvertureDessert", { liste: dessert.map((a) => a.nom).join(", ") }));
      break;
    }
    case "salle_creee":
      titre = t("ligne.salleCreee");
      break;
    case "fiche_modifiee":
      titre = t("ligne.ficheModifiee", { changements: changementsTexte(l.changes, f) });
      break;
    case "salle_archivee":
      titre = t("ligne.salleArchivee");
      break;
    case "salle_restauree":
      titre = t("ligne.salleRestauree");
      break;
    case "salle_supprimee":
      titre = t("ligne.salleSupprimee");
      break;
    case "plage_modifiee":
      titre = t("ligne.plageModifiee", { changements: changementsTexte(l.changes, f) });
      break;
    case "actif_installe":
      titre = t("ligne.actifInstalle", { actif: actifTexte(l) });
      break;
    case "actif_ajoute":
      titre = t("ligne.actifAjoute", { actif: actifTexte(l) });
      break;
    case "actif_entre":
      titre = t("ligne.actifEntre", { actif: actifTexte(l), salle: salleTexte(l.autreSalle, f) });
      detail.push(t("ligne.aussiAuRegistre", { salle: salleTexte(l.autreSalle, f) }));
      break;
    case "actif_sorti":
      titre = t("ligne.actifSorti", { actif: actifTexte(l), salle: salleTexte(l.autreSalle, f) });
      detail.push(t("ligne.aussiAuRegistre", { salle: salleTexte(l.autreSalle, f) }));
      break;
    case "actif_retire":
      titre = t("ligne.actifRetire", { actif: actifTexte(l) });
      break;
    case "actif_modifie":
      titre = t("ligne.actifModifie", { actif: actifTexte(l), changements: changementsTexte(l.changes, f) });
      break;
    case "actif_supprime":
      titre = t("ligne.actifSupprime", { actif: actifTexte(l) });
      break;
    case "actif_corrige":
      titre = t("ligne.actifCorrige", { actif: actifTexte(l) });
      if (d.codeInscrit) detail.push(t("ligne.codeInscrit", { code: String(d.codeInscrit) }));
      break;
    case "dessert_ajoute":
      titre = t("ligne.dessertAjoute", { actif: actifTexte(l) });
      break;
    case "dessert_retire":
      titre = t("ligne.dessertRetire", { actif: actifTexte(l) });
      break;
    case "registre_exporte": {
      const du = typeof d.du === "string" ? d.du : "";
      const au = typeof d.au === "string" ? d.au : "";
      titre = t("ligne.registreExporte", {
        du: du ? dateCourte(Date.parse(`${du}T12:00:00Z`), f.locale) : "—",
        au: au ? dateCourte(Date.parse(`${au}T12:00:00Z`), f.locale) : "—",
        format: d.format === "pdf" ? t("export.formatPdfCourt") : t("export.formatExcelCourt"),
      });
      if (typeof d.salles === "number" && d.salles > 1) detail.push(t("ligne.exportPlusieurs", { n: d.salles }));
      break;
    }
    case "capteur_pose":
      titre = t("ligne.capteurPose", { capteur: l.cible?.nom ?? "" });
      if (d.confirme === false) detail.push(t("ligne.capteurAConfirmer"));
      break;
    case "capteur_parti":
      titre = l.autreSalle
        ? t("ligne.capteurPartiVers", { capteur: l.cible?.nom ?? "", salle: salleTexte(l.autreSalle, f) })
        : t("ligne.capteurRetire", { capteur: l.cible?.nom ?? "" });
      break;
    case "capteur_nouveau":
      titre = d.sansSalle
        ? t("ligne.capteurNouveauSansSalle", { capteur: l.cible?.nom ?? "" })
        : t("ligne.capteurNouveau", { capteur: l.cible?.nom ?? "" });
      break;
    case "ecart": {
      const temp = d.grandeur === "c";
      const unite = temp ? "°C" : "%";
      const ext = `${nombre(d.extreme as number, f.locale)}${temp ? " °C" : " %"}`;
      titre = t(d.sens === "bas" ? "ligne.ecartBas" : "ligne.ecartHaut", {
        valeur: ext,
        duree: duree(d.dureeMin as number, t),
        plage: plageTexte(d.min as number | null, d.max as number | null, unite, f),
      });
      detail.push(t("ligne.ecartDetail", { n: d.n as number, capteur: l.cible?.nom ?? "" }));
      if (d.enCours) detail.push(t("ligne.enCours"));
      break;
    }
    case "muet":
      titre = t("ligne.muet", { duree: duree(d.dureeMin as number, t), n: d.manquants as number });
      detail.push(l.cible?.nom ?? "");
      if (d.enCours) detail.push(t("ligne.enCours"));
      break;
  }
  if (l.motif) {
    const k = `motif.${l.motif}`;
    detail.push(t("ligne.motif", { motif: t(k) === k ? l.motif : t(k) }));
  }
  if (l.note) detail.push(t("ligne.note", { note: l.note }));
  if (l.inscritA && l.parNom) {
    detail.push(t("ligne.inscritLe", { date: dateHeure(l.inscritA, f.locale), nom: l.parNom }));
  }
  return { titre, detail: detail.filter(Boolean).join(" · ") };
}

/** Qui a fait la ligne (ou d'où elle vient). */
export function auteurLigne(l: LigneRegistre, t: T): string {
  if (l.parNom) return l.parNom;
  if (l.source === "calcul") return t("ligne.calcule");
  if (l.source === "fournisseur") return "TempStick";
  if (l.source === "reprise") return t("ligne.reprise");
  if (l.source === "rattachement") return t("ligne.rattachement");
  return "";
}
