import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { Actif } from "@/lib/types";
import {
  LISTES_GMAO,
  STATUTS_FERMES,
  type ConfigEntretien,
  type FicheActif,
  type Intervention,
  type LigneReprise,
  type Regle,
  type StatutIntervention,
} from "@/lib/entretien/types";
import { sallesDesservies } from "@/lib/registre/actifs";
import { cached, invalidate } from "./cache";

// ============================================================
// Entretien des équipements — Firestore.
//   entretien_regles/{id}          règles d'entretien
//   entretien_interventions/{id}   miroir léger de chaque intervention
//                                  (et de sa tâche GANDALF)
//   entretien_fiches/{actifId}     photos et documents d'un équipement
//   entretien_reprise/{id}         séance de reprise de la GMAO (lot 0)
//   config/entretien               responsable, équipe, listes, interrupteurs
// ============================================================

const REGLES = "entretien_regles";
const INTERVENTIONS = "entretien_interventions";
const FICHES = "entretien_fiches";
const REPRISE = "entretien_reprise";
const CK_REGLES = "entretien:regles";
const CK_OUVERTES = "entretien:ouvertes";
const CK_CONFIG = "entretien:config";

const maintenant = () => new Date().toISOString();

// ── Réglages ──

export const CONFIG_DEFAUT: ConfigEntretien = {
  responsable: "",
  equipe: [],
  metiers: {},
  // « MAINTENANCE – MÉCANIQUE – ÉQUIPEMENTS (capex) », où sont déjà les préventifs (D3),
  // listes « Liste des préventifs récurrents à planifier » et « À FAIRE ».
  projetGandalf: "rh2prIyBktTPlQEBgBsU",
  listePreventifs: "1yiMzSEXTBGbRF39oeNM",
  listeProblemes: "6lRtVEgtR7vNOBopcH9F",
  tachesActives: true,
  avisActifs: true,
  listes: LISTES_GMAO,
};

function lireConfig(d: FirebaseFirestore.DocumentData | undefined): ConfigEntretien {
  const x = d ?? {};
  const listes = (x.listes ?? {}) as Partial<ConfigEntretien["listes"]>;
  const tableau = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
  return {
    responsable: typeof x.responsable === "string" ? x.responsable : "",
    equipe: tableau(x.equipe),
    metiers: x.metiers && typeof x.metiers === "object" ? (x.metiers as Record<string, string>) : {},
    projetGandalf: typeof x.projetGandalf === "string" && x.projetGandalf ? x.projetGandalf : CONFIG_DEFAUT.projetGandalf,
    listePreventifs: typeof x.listePreventifs === "string" ? x.listePreventifs : CONFIG_DEFAUT.listePreventifs,
    listeProblemes: typeof x.listeProblemes === "string" ? x.listeProblemes : CONFIG_DEFAUT.listeProblemes,
    tachesActives: x.tachesActives !== false,
    avisActifs: x.avisActifs !== false,
    listes: {
      types: tableau(listes.types).length ? tableau(listes.types) : LISTES_GMAO.types,
      priorites: tableau(listes.priorites).length ? tableau(listes.priorites) : LISTES_GMAO.priorites,
      metiers: tableau(listes.metiers).length ? tableau(listes.metiers) : LISTES_GMAO.metiers,
      criticites: tableau(listes.criticites).length ? tableau(listes.criticites) : LISTES_GMAO.criticites,
      departements: tableau(listes.departements).length ? tableau(listes.departements) : LISTES_GMAO.departements,
    },
  };
}

export async function getConfigEntretien(): Promise<ConfigEntretien> {
  return cached(CK_CONFIG, async () => {
    const d = await adminDb().collection("config").doc("entretien").get();
    return lireConfig(d.data());
  });
}

export async function saveConfigEntretien(patch: Partial<ConfigEntretien>, par: string): Promise<ConfigEntretien> {
  const ref = adminDb().collection("config").doc("entretien");
  await ref.set({ ...patch, _updated_by: par, _updated_at: maintenant() }, { merge: true });
  invalidate(CK_CONFIG);
  return getConfigEntretien();
}

// ── Règles ──

export function docVersRegle(id: string, d: FirebaseFirestore.DocumentData): Regle {
  return {
    id,
    titre: d.titre ?? "",
    type: d.type ?? "",
    consigne: d.consigne ?? "",
    procedureUrl: d.procedureUrl ?? "",
    actifIds: Array.isArray(d.actifIds) ? d.actifIds : [],
    salleIds: Array.isArray(d.salleIds) ? d.salleIds : [],
    equipementLibre: d.equipementLibre ?? "",
    frequence: d.frequence ?? null,
    prochaine: d.prochaine ?? null,
    calcul: d.calcul === "faite" ? "faite" : "prevue",
    fenetreJours: typeof d.fenetreJours === "number" ? d.fenetreJours : null,
    qui: d.qui ?? null,
    checklist: Array.isArray(d.checklist) ? d.checklist : [],
    preuve: d.preuve ?? "aucune",
    mesureUnite: d.mesureUnite ?? "",
    criticite: d.criticite ?? "",
    etat: d.etat ?? "active",
    origine: d.origine ?? null,
    remarque: d.remarque ?? "",
    creeA: d.creeA ?? "",
    creePar: d.creePar ?? "",
    modifieA: d.modifieA ?? "",
    modifiePar: d.modifiePar ?? "",
  };
}

export async function getRegles(): Promise<Regle[]> {
  return cached(CK_REGLES, async () => {
    const snap = await adminDb().collection(REGLES).get();
    return snap.docs
      .map((d) => docVersRegle(d.id, d.data()))
      .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  });
}

export async function getRegle(id: string): Promise<Regle | null> {
  const d = await adminDb().collection(REGLES).doc(id).get();
  return d.exists ? docVersRegle(d.id, d.data()!) : null;
}

export type DonneesRegle = Omit<Regle, "id" | "creeA" | "creePar" | "modifieA" | "modifiePar">;

export async function creerRegle(r: DonneesRegle, par: string, id?: string): Promise<Regle> {
  const col = adminDb().collection(REGLES);
  const ref = id ? col.doc(id) : col.doc();
  const t = maintenant();
  await ref.set({ ...r, creeA: t, creePar: par, modifieA: t, modifiePar: par });
  invalidate(CK_REGLES);
  return docVersRegle(ref.id, { ...r, creeA: t, creePar: par, modifieA: t, modifiePar: par });
}

export async function modifierRegle(id: string, patch: Partial<DonneesRegle>, par: string): Promise<void> {
  await adminDb()
    .collection(REGLES)
    .doc(id)
    .set({ ...patch, modifieA: maintenant(), modifiePar: par }, { merge: true });
  invalidate(CK_REGLES);
}

/** Salles d'une règle : celles de ses équipements (et celles qu'ils desservent), plus ses salles explicites. */
export function sallesDeRegle(r: Pick<Regle, "actifIds" | "salleIds">, actifs: Map<string, Actif>): string[] {
  const out = new Set(r.salleIds);
  for (const id of r.actifIds) {
    const a = actifs.get(id);
    if (!a) continue;
    if (a.idSalle) out.add(a.idSalle);
  }
  return [...out];
}

/** Règles qui touchent une salle : par un équipement présent ou qui la dessert, ou par la salle elle-même. */
export function reglesDeLaSalle(regles: Regle[], salleId: string, actifs: Map<string, Actif>): Regle[] {
  return regles.filter((r) => {
    if (r.etat === "archivee") return false;
    if (r.salleIds.includes(salleId)) return true;
    return r.actifIds.some((id) => {
      const a = actifs.get(id);
      return !!a && (a.idSalle === salleId || sallesDesservies(a.locauxDesservis).includes(salleId));
    });
  });
}

// ── Interventions ──

export function docVersIntervention(id: string, d: FirebaseFirestore.DocumentData): Intervention {
  return {
    id,
    genre: d.genre === "probleme" ? "probleme" : "preventif",
    regleId: d.regleId ?? null,
    titre: d.titre ?? "",
    consigne: d.consigne ?? "",
    type: d.type ?? "",
    actifIds: Array.isArray(d.actifIds) ? d.actifIds : [],
    salleIds: Array.isArray(d.salleIds) ? d.salleIds : [],
    equipementLibre: d.equipementLibre ?? "",
    echeance: d.echeance ?? null,
    ouverture: d.ouverture ?? null,
    priorite: typeof d.priorite === "number" ? d.priorite : null,
    criticite: d.criticite ?? "",
    statut: d.statut ?? "a_faire",
    assignes: Array.isArray(d.assignes) ? d.assignes : [],
    checklist: Array.isArray(d.checklist) ? d.checklist : [],
    preuveExigee: d.preuveExigee ?? "aucune",
    mesureUnite: d.mesureUnite ?? "",
    preuves: Array.isArray(d.preuves) ? d.preuves : [],
    mesure: d.mesure ?? "",
    photos: Array.isArray(d.photos) ? d.photos : [],
    description: d.description ?? "",
    noteFin: d.noteFin ?? "",
    tacheId: d.tacheId ?? null,
    tacheStatut: d.tacheStatut ?? null,
    tacheLueA: d.tacheLueA ?? null,
    signalePar: d.signalePar ?? null,
    creeA: d.creeA ?? "",
    creePar: d.creePar ?? "",
    termineA: d.termineA ?? null,
    terminePar: d.terminePar ?? null,
    valideA: d.valideA ?? null,
    validePar: d.validePar ?? null,
    annuleA: d.annuleA ?? null,
    annulePar: d.annulePar ?? null,
    motif: d.motif ?? "",
    horsService: Boolean(d.horsService),
    statutActifAvant: typeof d.statutActifAvant === "string" ? d.statutActifAvant : undefined,
    avis: d.avis && typeof d.avis === "object" ? d.avis : {},
    dernierAvis: d.dernierAvis ?? null,
  };
}

/** Interventions pas encore validées ni annulées (file, calendrier, tâche de nuit). */
export async function getInterventionsOuvertes(): Promise<Intervention[]> {
  return cached(CK_OUVERTES, async () => {
    const snap = await adminDb()
      .collection(INTERVENTIONS)
      .where("statut", "in", ["a_assigner", "a_faire", "en_cours", "en_attente", "a_valider"])
      .get();
    return snap.docs.map((d) => docVersIntervention(d.id, d.data()));
  });
}

export function invaliderInterventions(): void {
  invalidate(CK_OUVERTES);
}

/** Toutes les interventions d'une salle (ouvertes et fermées). */
export async function interventionsDeLaSalle(salleId: string): Promise<Intervention[]> {
  const snap = await adminDb().collection(INTERVENTIONS).where("salleIds", "array-contains", salleId).get();
  return snap.docs.map((d) => docVersIntervention(d.id, d.data())).sort((a, b) => b.creeA.localeCompare(a.creeA));
}

/** Toutes les interventions d'un équipement. */
export async function interventionsDeLActif(actifId: string): Promise<Intervention[]> {
  const snap = await adminDb().collection(INTERVENTIONS).where("actifIds", "array-contains", actifId).get();
  return snap.docs.map((d) => docVersIntervention(d.id, d.data())).sort((a, b) => b.creeA.localeCompare(a.creeA));
}

/** Interventions d'une règle. */
export async function interventionsDeLaRegle(regleId: string): Promise<Intervention[]> {
  const snap = await adminDb().collection(INTERVENTIONS).where("regleId", "==", regleId).get();
  return snap.docs.map((d) => docVersIntervention(d.id, d.data())).sort((a, b) => b.creeA.localeCompare(a.creeA));
}

/** Interventions fermées (validées ou annulées) depuis `du` (ISO) : registre, export, historique. */
export async function interventionsFermeesDepuis(du: string): Promise<Intervention[]> {
  const db = adminDb();
  const [v, a] = await Promise.all([
    db.collection(INTERVENTIONS).where("valideA", ">=", du).get(),
    db.collection(INTERVENTIONS).where("annuleA", ">=", du).get(),
  ]);
  const vus = new Map<string, Intervention>();
  for (const d of [...v.docs, ...a.docs]) vus.set(d.id, docVersIntervention(d.id, d.data()));
  return [...vus.values()].filter((x) => STATUTS_FERMES.includes(x.statut));
}

export async function getIntervention(id: string): Promise<Intervention | null> {
  const d = await adminDb().collection(INTERVENTIONS).doc(id).get();
  return d.exists ? docVersIntervention(d.id, d.data()!) : null;
}

export type DonneesIntervention = Omit<Intervention, "id">;

export async function creerIntervention(x: DonneesIntervention, id?: string): Promise<Intervention> {
  const col = adminDb().collection(INTERVENTIONS);
  const ref = id ? col.doc(id) : col.doc();
  await ref.set(x);
  invaliderInterventions();
  return { id: ref.id, ...x };
}

/**
 * Crée l'occurrence d'une règle une seule fois : l'id est déterministe
 * (règle + échéance), et la transaction refuse s'il existe déjà une
 * occurrence ouverte de la règle (une seule occurrence ouverte par règle).
 */
export async function creerOccurrence(x: DonneesIntervention): Promise<Intervention | null> {
  if (!x.regleId || !x.echeance) throw new Error("occurrence sans règle ni échéance");
  const db = adminDb();
  const ref = db.collection(INTERVENTIONS).doc(`${x.regleId}__${x.echeance}`);
  const cree = await db.runTransaction(async (tx) => {
    const ouvertes = await tx.get(db.collection(INTERVENTIONS).where("regleId", "==", x.regleId));
    const deja = ouvertes.docs.some((d) => !STATUTS_FERMES.includes(d.data().statut as StatutIntervention));
    const meme = await tx.get(ref);
    if (deja || meme.exists) return false;
    tx.set(ref, x);
    return true;
  });
  invaliderInterventions();
  return cree ? { id: ref.id, ...x } : null;
}

export async function modifierIntervention(id: string, patch: Partial<DonneesIntervention>): Promise<void> {
  await adminDb().collection(INTERVENTIONS).doc(id).set(patch, { merge: true });
  invaliderInterventions();
}

/**
 * Change le statut seulement s'il est encore l'un des `depuis` (deux personnes
 * qui valident en même temps : une seule passe). Renvoie l'intervention à jour, ou null.
 */
export async function transition(
  id: string,
  depuis: StatutIntervention[],
  patch: Partial<DonneesIntervention>
): Promise<Intervention | null> {
  const db = adminDb();
  const ref = db.collection(INTERVENTIONS).doc(id);
  const res = await db.runTransaction(async (tx) => {
    const d = await tx.get(ref);
    if (!d.exists) return null;
    const avant = docVersIntervention(d.id, d.data()!);
    if (!depuis.includes(avant.statut)) return null;
    tx.set(ref, patch, { merge: true });
    return { ...avant, ...patch } as Intervention;
  });
  invaliderInterventions();
  return res;
}

/** Note un avis envoyé (étape → jour) et le jour du dernier avis. */
export async function noterAvis(id: string, etape: string, jour: string): Promise<void> {
  await adminDb()
    .collection(INTERVENTIONS)
    .doc(id)
    .update({ [`avis.${etape}`]: jour, dernierAvis: jour });
  invaliderInterventions();
}

export async function ajouterFichiers(
  id: string,
  champ: "preuves" | "photos",
  fichiers: Intervention["preuves"]
): Promise<void> {
  if (!fichiers.length) return;
  await adminDb()
    .collection(INTERVENTIONS)
    .doc(id)
    .update({ [champ]: FieldValue.arrayUnion(...fichiers) });
  invaliderInterventions();
}

// ── Fiches d'équipement (photos, documents) ──

export async function getFiche(actifId: string): Promise<FicheActif> {
  const d = await adminDb().collection(FICHES).doc(actifId).get();
  const x = d.data() ?? {};
  return {
    actifId,
    photos: Array.isArray(x.photos) ? x.photos : [],
    documents: Array.isArray(x.documents) ? x.documents : [],
  };
}

export async function getFiches(): Promise<Map<string, FicheActif>> {
  return cached("entretien:fiches", async () => {
    const snap = await adminDb().collection(FICHES).get();
    return new Map(
      snap.docs.map((d) => {
        const x = d.data();
        return [
          d.id,
          { actifId: d.id, photos: Array.isArray(x.photos) ? x.photos : [], documents: Array.isArray(x.documents) ? x.documents : [] },
        ];
      })
    );
  });
}

export async function ajouterPhotoActif(actifId: string, photo: FicheActif["photos"][number]): Promise<void> {
  await adminDb()
    .collection(FICHES)
    .doc(actifId)
    .set({ photos: FieldValue.arrayUnion(photo) }, { merge: true });
  invalidate("entretien:fiches");
}

export async function ajouterDocumentActif(actifId: string, doc: FicheActif["documents"][number]): Promise<void> {
  await adminDb()
    .collection(FICHES)
    .doc(actifId)
    .set({ documents: FieldValue.arrayUnion(doc) }, { merge: true });
  invalidate("entretien:fiches");
}

// ── Reprise de la GMAO (lot 0) ──

export function docVersReprise(id: string, d: FirebaseFirestore.DocumentData): LigneReprise {
  return {
    id,
    ordre: typeof d.ordre === "number" ? d.ordre : 0,
    groupe: d.groupe ?? "regle",
    titre: d.titre ?? "",
    constat: d.constat ?? "",
    source: d.source ?? "",
    proposition: d.proposition ?? "",
    regle: d.regle ?? null,
    tachesARemplacer: Array.isArray(d.tachesARemplacer) ? d.tachesARemplacer : [],
    decision: d.decision ?? "a_decider",
    noteDecision: d.noteDecision ?? "",
    decidePar: d.decidePar ?? "",
    decideA: d.decideA ?? "",
    importeA: d.importeA ?? null,
    regleCreee: d.regleCreee ?? null,
  };
}

export async function getReprise(): Promise<LigneReprise[]> {
  const snap = await adminDb().collection(REPRISE).get();
  return snap.docs.map((d) => docVersReprise(d.id, d.data())).sort((a, b) => a.ordre - b.ordre);
}

export async function modifierReprise(id: string, patch: Partial<LigneReprise>): Promise<void> {
  await adminDb().collection(REPRISE).doc(id).set(patch, { merge: true });
}
