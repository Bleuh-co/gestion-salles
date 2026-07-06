import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import type { Actif } from "@/lib/types";
import { cached, invalidate } from "./cache";

// ============================================================
// Repo Actifs (équipements) — Firestore est la source de vérité
// unique. Collection : "actifs", doc id = actif.id.
// Données initiales importées via la migration du 2026-07-06.
// ============================================================

const COLLECTION = "actifs";
const CACHE_KEY = "actifs:all";

export const ACTIF_EDITABLE_FIELDS = [
  "matricule",
  "idMasterlist",
  "nom",
  "idSalle",
  "locauxDesservis",
  "categorie",
  "numeroSequence",
  "locauxActifsDesservis",
  "marque",
  "modele",
  "numSerie",
  "photoPlaque",
  "photoActif",
  "parentId",
  "criticite",
  "dateInstall",
  "statut",
] as const;

export type ActifEditableField = (typeof ACTIF_EDITABLE_FIELDS)[number];

function docToActif(id: string, data: FirebaseFirestore.DocumentData): Actif {
  return {
    id,
    matricule: data.matricule ?? "",
    idMasterlist: data.idMasterlist ?? "",
    nom: data.nom ?? "",
    idSalle: data.idSalle ?? "",
    locauxDesservis: data.locauxDesservis ?? "",
    categorie: data.categorie ?? "",
    numeroSequence: data.numeroSequence ?? "",
    locauxActifsDesservis: data.locauxActifsDesservis ?? "",
    marque: data.marque ?? "",
    modele: data.modele ?? "",
    numSerie: data.numSerie ?? "",
    photoPlaque: data.photoPlaque ?? "",
    photoActif: data.photoActif ?? "",
    parentId: data.parentId ?? "",
    criticite: data.criticite ?? "",
    dateInstall: data.dateInstall ?? "",
    statut: data.statut ?? "",
  };
}

async function loadAll(): Promise<Actif[]> {
  const snap = await adminDb().collection(COLLECTION).get();
  return snap.docs
    .map((d) => docToActif(d.id, d.data()))
    .sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }));
}

export async function getAllActifs(): Promise<Actif[]> {
  return cached(CACHE_KEY, loadAll);
}

export function invalidateActifsCache(): void {
  invalidate(CACHE_KEY);
}

export async function getActif(id: string): Promise<Actif | undefined> {
  const all = await getAllActifs();
  return all.find((a) => a.id === id);
}

export async function getActifsBySalle(salleId: string): Promise<Actif[]> {
  const all = await getAllActifs();
  return all.filter((a) => a.idSalle === salleId || a.locauxDesservis.includes(salleId));
}

// ============================================================
// Écritures
// ============================================================

function metaFields(updatedBy: string) {
  return { _updated_by: updatedBy, _updated_at: new Date().toISOString() };
}

export async function createActif(actif: Actif, createdBy: string): Promise<void> {
  const ref = adminDb().collection(COLLECTION).doc(actif.id);
  await adminDb().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      throw new Error(`L'actif "${actif.id}" existe déjà`);
    }
    const { id: _id, ...fields } = actif;
    tx.set(ref, {
      ...fields,
      _created_by: createdBy,
      _created_at: new Date().toISOString(),
      ...metaFields(createdBy),
    });
  });
  invalidateActifsCache();
}

export async function updateActif(
  id: string,
  fields: Partial<Pick<Actif, ActifEditableField>>,
  updatedBy: string
): Promise<void> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && (ACTIF_EDITABLE_FIELDS as readonly string[]).includes(k)) {
      clean[k] = v;
    }
  }
  if (Object.keys(clean).length === 0) return;

  const ref = adminDb().collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new Error(`Actif "${id}" introuvable`);
  await ref.set({ ...clean, ...metaFields(updatedBy) }, { merge: true });
  invalidateActifsCache();
}

export async function deleteActif(id: string): Promise<void> {
  await adminDb().collection(COLLECTION).doc(id).delete();
  invalidateActifsCache();
}
