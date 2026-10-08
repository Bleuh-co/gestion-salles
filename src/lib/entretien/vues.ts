import "server-only";

import type { Actif } from "@/lib/types";
import { nomsPersonnes } from "@/lib/repo/personnes";
import {
  getFiche,
  getFiches,
  getInterventionsOuvertes,
  getRegles,
  interventionsDeLActif,
  interventionsDeLaSalle,
  interventionsFermeesDepuis,
  reglesDeLaSalle,
  sallesDeRegle,
} from "@/lib/repo/entretien";
import { sallesDesservies } from "@/lib/registre/actifs";
import { ajouterJours } from "@/lib/registre/temps";
import { echeancesEntre, joursAvant, ouvertureDe } from "./calendrier";
import { urlFichier } from "./fichiers";
import { assignesDe, aujourdHui, contexte, nomEquipements, nomSalles, relireTaches, type Contexte } from "./service";
import { STATUTS_OUVERTS, type Fichier, type Intervention, type Regle } from "./types";

// ============================================================
// Ce que les écrans de l'entretien reçoivent : règles et
// interventions mises en forme (retards, noms, liens), après
// relecture des tâches GANDALF ouvertes.
// ============================================================

export type EtatRegleVue = "en_retard" | "en_cours" | "a_venir" | "a_planifier" | "archivee";

export interface RegleVue extends Regle {
  etatVue: EtatRegleVue;
  /** Jours de retard (positif) de l'occurrence ouverte ou de la prochaine échéance passée. */
  retard: number;
  ouvertureProchaine: string | null;
  interventionOuverte: string | null;
  equipements: string;
  salles: string[];
  qui: Regle["qui"];
  quiNom: string;
}

export interface InterventionVue extends Omit<Intervention, "preuves" | "photos"> {
  preuves: FichierVue[];
  photos: FichierVue[];
  retard: number | null;
  lieu: string;
  equipements: string;
  assignesNoms: string[];
}

export interface FichierVue extends Fichier {
  lien: string;
}

const fichierVue = (f: Fichier): FichierVue => ({ ...f, lien: urlFichier(f) });

async function nomsDe(emails: string[]) {
  return nomsPersonnes(emails.filter(Boolean));
}

function retardDe(echeance: string | null, jour: string): number | null {
  return echeance ? -joursAvant(echeance, jour) : null;
}

export async function interventionsVues(ivs: Intervention[], ctx: Contexte, jour = aujourdHui()): Promise<InterventionVue[]> {
  const noms = await nomsDe(ivs.flatMap((iv) => iv.assignes));
  return ivs.map((iv) => ({
    ...iv,
    preuves: iv.preuves.map(fichierVue),
    photos: iv.photos.map(fichierVue),
    retard: STATUTS_OUVERTS.includes(iv.statut) ? retardDe(iv.echeance, jour) : null,
    lieu: nomSalles(iv.salleIds, ctx),
    equipements: nomEquipements(iv, ctx),
    assignesNoms: iv.assignes.map((e) => noms.get(e) || e),
  }));
}

async function reglesVues(regles: Regle[], ouvertes: Intervention[], ctx: Contexte, jour: string): Promise<RegleVue[]> {
  const quiEmails = regles.flatMap((r) => assignesDe(r.qui, ctx.config));
  const noms = await nomsDe(quiEmails);
  return regles.map((r) => {
    const iv = ouvertes.find((x) => x.regleId === r.id && STATUTS_OUVERTS.concat(["a_valider"]).includes(x.statut));
    let etatVue: EtatRegleVue;
    let retard = 0;
    if (r.etat === "archivee") etatVue = "archivee";
    else if (iv) {
      retard = Math.max(0, retardDe(iv.echeance, jour) ?? 0);
      etatVue = retard > 0 && iv.statut !== "a_valider" ? "en_retard" : "en_cours";
    } else if (r.etat === "a_completer" || !r.prochaine || !r.frequence) etatVue = "a_planifier";
    else {
      retard = Math.max(0, retardDe(r.prochaine, jour) ?? 0);
      etatVue = retard > 0 ? "en_retard" : "a_venir";
    }
    const email = assignesDe(r.qui, ctx.config)[0];
    const quiNom =
      r.qui?.type === "soustraitant"
        ? [r.qui.fournisseur || "sous-traitant", email ? `répondant : ${noms.get(email) || email}` : ""].filter(Boolean).join(" · ")
        : r.qui?.type === "metier"
          ? `${r.qui.metier}${email ? ` → ${noms.get(email) || email}` : ""}`
          : email
            ? noms.get(email) || email
            : "";
    return {
      ...r,
      etatVue,
      retard,
      ouvertureProchaine: r.prochaine ? ouvertureDe(r.prochaine, r) : null,
      interventionOuverte: iv?.id ?? null,
      equipements: nomEquipements(r, ctx),
      salles: sallesDeRegle(r, ctx.actifs),
      quiNom,
    };
  });
}

// ── Onglet « Entretien » d'une salle (V1) ──

export interface ActifEntretien {
  id: string;
  nom: string;
  matricule: string;
  idMasterlist: string;
  criticite: string;
  statut: string;
  dessert: boolean;
  regles: number;
  prochaine: string | null;
  enRetard: boolean;
  documents: number;
  photos: number;
}

export interface VueSalle {
  salleId: string;
  regles: RegleVue[];
  interventions: InterventionVue[];
  actifs: ActifEntretien[];
  derniereValidee: string | null;
  jour: string;
  config: { responsable: boolean; equipe: boolean };
}

export async function vueSalle(salleId: string): Promise<VueSalle> {
  const ctx = await contexte();
  const jour = aujourdHui();
  const [regles, toutes, fiches] = await Promise.all([getRegles(), interventionsDeLaSalle(salleId), getFiches()]);
  const ouvertesAvant = toutes.filter((iv) => STATUTS_OUVERTS.includes(iv.statut) || iv.statut === "a_valider");
  const relues = await relireTaches(ouvertesAvant, ctx).catch((e) => {
    console.warn("[entretien] relecture des tâches", e);
    return ouvertesAvant;
  });
  const parId = new Map(relues.map((iv) => [iv.id, iv]));
  const ivs = toutes.map((iv) => parId.get(iv.id) ?? iv);
  const reglesSalle = reglesDeLaSalle(regles, salleId, ctx.actifs);
  const rv = await reglesVues(reglesSalle, ivs, ctx, jour);

  const actifsSalle = [...ctx.actifs.values()].filter(
    (a) => a.idSalle === salleId || sallesDesservies(a.locauxDesservis).includes(salleId)
  );
  const actifs: ActifEntretien[] = actifsSalle.map((a: Actif) => {
    const sesRegles = rv.filter((r) => r.actifIds.includes(a.id) && r.etat !== "archivee");
    const dates = sesRegles.map((r) => r.prochaine).filter((d): d is string => !!d).sort();
    const f = fiches.get(a.id);
    return {
      id: a.id,
      nom: a.nom,
      matricule: a.matricule,
      idMasterlist: a.idMasterlist,
      criticite: a.criticite,
      statut: a.statut,
      dessert: a.idSalle !== salleId,
      regles: sesRegles.length,
      prochaine: dates[0] ?? null,
      enRetard: sesRegles.some((r) => r.etatVue === "en_retard"),
      documents: f?.documents.length ?? 0,
      photos: f?.photos.length ?? 0,
    };
  });
  const validees = ivs.filter((iv) => iv.statut === "validee" && iv.valideA).map((iv) => iv.valideA!).sort();
  return {
    salleId,
    regles: rv.filter((r) => r.etatVue !== "archivee"),
    interventions: await interventionsVues(ivs, ctx, jour),
    actifs,
    derniereValidee: validees[validees.length - 1] ?? null,
    jour,
    config: { responsable: !!ctx.config.responsable, equipe: ctx.config.equipe.length > 0 },
  };
}

// ── Page d'un équipement (V2) ──

export interface VueActif {
  actif: Actif;
  salleNom: string;
  photos: FichierVue[];
  documents: { nom: string; url: string; source: string }[];
  regles: RegleVue[];
  interventions: InterventionVue[];
  jour: string;
}

export async function vueActif(actifId: string): Promise<VueActif | null> {
  const ctx = await contexte();
  const actif = ctx.actifs.get(actifId);
  if (!actif) return null;
  const jour = aujourdHui();
  const [regles, ivsBrutes, fiche] = await Promise.all([getRegles(), interventionsDeLActif(actifId), getFiche(actifId)]);
  const ouvertes = ivsBrutes.filter((iv) => STATUTS_OUVERTS.includes(iv.statut) || iv.statut === "a_valider");
  const relues = await relireTaches(ouvertes, ctx).catch(() => ouvertes);
  const parId = new Map(relues.map((iv) => [iv.id, iv]));
  const ivs = ivsBrutes.map((iv) => parId.get(iv.id) ?? iv);
  const sesRegles = regles.filter((r) => r.actifIds.includes(actifId) && r.etat !== "archivee");
  return {
    actif,
    salleNom: ctx.salles.get(actif.idSalle)?.nomSalle || "",
    photos: fiche.photos.map(fichierVue),
    documents: fiche.documents,
    regles: await reglesVues(sesRegles, ivs, ctx, jour),
    interventions: await interventionsVues(ivs, ctx, jour),
    jour,
  };
}

// ── File des interventions (V8) ──

let derniereRelecture = 0;

export async function vueFile(): Promise<{ interventions: InterventionVue[]; jour: string }> {
  const ctx = await contexte();
  const jour = aujourdHui();
  let ouvertes = await getInterventionsOuvertes();
  // Relecture au plus une fois par minute : la file se rouvre souvent.
  if (Date.now() - derniereRelecture > 60_000) {
    derniereRelecture = Date.now();
    ouvertes = await relireTaches(ouvertes, ctx).catch(() => ouvertes);
  }
  const fermees = await interventionsFermeesDepuis(new Date(Date.now() - 45 * 86_400_000).toISOString());
  return { interventions: await interventionsVues([...ouvertes, ...fermees], ctx, jour), jour };
}

// ── Calendrier sur 12 mois (V7) ──

export interface LigneCalendrier {
  regle: RegleVue;
  echeances: string[];
  passees: number;
}

export async function vueCalendrier(): Promise<{ lignes: LigneCalendrier[]; jour: string; fin: string }> {
  const ctx = await contexte();
  const jour = aujourdHui();
  const fin = ajouterJours(jour, 365);
  const [regles, ouvertes] = await Promise.all([getRegles(), getInterventionsOuvertes()]);
  const rv = await reglesVues(regles.filter((r) => r.etat !== "archivee"), ouvertes, ctx, jour);
  const lignes = rv.map((r) => {
    const iv = ouvertes.find((x) => x.id === r.interventionOuverte);
    // L'occurrence ouverte et en retard compte comme « passée » ; la série reprend après elle.
    const depuis = iv?.echeance && iv.echeance < jour ? iv.echeance : r.prochaine;
    const toutes = r.frequence && depuis ? echeancesEntre({ frequence: r.frequence, calcul: r.calcul, prochaine: depuis }, "2000-01-01", fin) : [];
    return {
      regle: r,
      echeances: toutes.filter((e) => e >= jour),
      passees: toutes.filter((e) => e < jour).length,
    };
  });
  return { lignes, jour, fin };
}

/** Pastille de l'onglet « Entretien » : entretiens en retard et problèmes ouverts de la salle (sans relire GANDALF). */
export async function compteASuivre(salleId: string): Promise<number> {
  const ctx = await contexte();
  const jour = aujourdHui();
  const [regles, ivs] = await Promise.all([getRegles(), interventionsDeLaSalle(salleId)]);
  const ouvertes = ivs.filter((iv) => STATUTS_OUVERTS.includes(iv.statut));
  const retards = reglesDeLaSalle(regles, salleId, ctx.actifs).filter((r) => {
    if (r.etat !== "active") return false;
    const iv = ouvertes.find((x) => x.regleId === r.id);
    const e = iv?.echeance ?? r.prochaine;
    return !!e && e < jour;
  }).length;
  return retards + ouvertes.filter((iv) => iv.genre === "probleme").length;
}
