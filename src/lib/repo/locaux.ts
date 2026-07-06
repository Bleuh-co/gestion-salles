import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import type { Local } from "@/lib/types";
import { locaux as staticLocaux } from "@/lib/data";
import { loadLocauxOverrides, mergeOverrides } from "@/lib/locaux-overrides";
import { cached, invalidate } from "./cache";

// ============================================================
// Repo Locaux — Firestore est la source de vérité.
//
// Collection : "locaux", doc id = code de salle (local.id).
// Le code de salle est IMMUABLE après création (les QR codes
// imprimés, plans, capteurs et actifs pointent dessus).
//
// Fallback : tant que la collection est vide (migration pas
// encore exécutée via /api/admin/migrate-firestore), on sert
// l'ancienne source statique (data.ts ⊕ locaux_overrides) pour
// que le déploiement soit sans coupure.
// ============================================================

const COLLECTION = "locaux";
const CACHE_KEY = "locaux:all";

/** Champs Local éditables après création (le code `id` est immuable). */
export const LOCAL_EDITABLE_FIELDS = [
  "nomSalle",
  "batiment",
  "etage",
  "famille",
  "idLicence",
  "prod",
  "vocation",
  "conditions",
  "statut",
  "niveauAcces",
] as const;

export type LocalEditableField = (typeof LOCAL_EDITABLE_FIELDS)[number];

function docToLocal(id: string, data: FirebaseFirestore.DocumentData): Local {
  return {
    id,
    nomSalle: data.nomSalle ?? "",
    batiment: data.batiment ?? "",
    etage: data.etage ?? "",
    famille: data.famille ?? "",
    idLicence: data.idLicence ?? "",
    prod: Boolean(data.prod),
    vocation: data.vocation ?? "",
    conditions: data.conditions ?? "",
    statut: data.statut ?? "en_service",
    niveauAcces: data.niveauAcces ?? "",
    archived: Boolean(data.archived),
  };
}

/** La migration one-shot a-t-elle été exécutée ? (drapeau config/migration) */
async function isMigrationDone(): Promise<boolean> {
  const doc = await adminDb().collection("config").doc("migration").get();
  return doc.exists && doc.data()?.done === true;
}

async function loadAll(): Promise<Local[]> {
  const db = adminDb();
  const [snap, migrated] = await Promise.all([
    db.collection(COLLECTION).get(),
    isMigrationDone(),
  ]);

  const fromFirestore = snap.docs
    .map((d) => docToLocal(d.id, d.data()))
    .sort((a, b) => a.id.localeCompare(b.id, "fr"));

  if (migrated) return fromFirestore;

  // Pré-migration : la source statique reste la base, et les documents
  // Firestore déjà créés (éditions, nouvelles salles) priment par id.
  // Sans ce merge, la première écriture ferait "disparaître" les autres
  // salles en désactivant le fallback.
  const overrides = await loadLocauxOverrides();
  const base = mergeOverrides(staticLocaux, overrides);
  const byId = new Map(base.map((l) => [l.id, l]));
  for (const l of fromFirestore) byId.set(l.id, l);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, "fr"));
}

/** Tous les locaux (avec cache TTL court). */
export async function getAllLocaux(): Promise<Local[]> {
  return cached(CACHE_KEY, loadAll);
}

export function invalidateLocauxCache(): void {
  invalidate(CACHE_KEY);
}

// ============================================================
// Lectures — mêmes signatures que l'ancien data.ts, en async
// ============================================================

export interface GetLocauxOpts {
  famille?: string;
  etage?: string;
  statut?: string;
  q?: string;
  includeArchived?: boolean;
}

export async function getLocaux(opts?: GetLocauxOpts): Promise<Local[]> {
  let result = await getAllLocaux();
  if (!opts?.includeArchived) {
    result = result.filter((l) => !l.archived);
  }
  if (opts?.famille) {
    result = result.filter((l) => l.famille === opts.famille);
  }
  if (opts?.etage) {
    result = result.filter((l) => l.etage.toUpperCase() === opts.etage!.toUpperCase());
  }
  if (opts?.statut) {
    result = result.filter((l) => l.statut === opts.statut);
  }
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    result = result.filter(
      (l) =>
        l.id.toLowerCase().includes(q) ||
        l.nomSalle.toLowerCase().includes(q) ||
        l.vocation.toLowerCase().includes(q) ||
        l.famille.toLowerCase().includes(q)
    );
  }
  return result;
}

export async function getLocal(id: string): Promise<Local | undefined> {
  const all = await getAllLocaux();
  return all.find((l) => l.id === id);
}

export async function getUniqueFamilles(): Promise<string[]> {
  const all = await getAllLocaux();
  return [...new Set(all.filter((l) => !l.archived).map((l) => l.famille))].sort();
}

export async function getUniqueEtages(): Promise<string[]> {
  const all = await getAllLocaux();
  return [...new Set(all.filter((l) => !l.archived).map((l) => l.etage))].sort();
}

export async function getUniqueBatiments(): Promise<string[]> {
  const all = await getAllLocaux();
  return [...new Set(all.filter((l) => !l.archived).map((l) => l.batiment))].sort();
}

export async function getLocauxStats(): Promise<{
  total: number;
  enService: number;
  enConstruction: number;
  horsService: number;
  enQualification: number;
}> {
  const all = await getAllLocaux();
  const active = all.filter((l) => !l.archived);
  return {
    total: active.length,
    enService: active.filter((l) => l.statut === "en_service").length,
    enConstruction: active.filter((l) => l.statut === "en_construction").length,
    horsService: active.filter((l) => l.statut === "hors_service").length,
    enQualification: active.filter((l) => l.statut === "en_qualification").length,
  };
}

// ============================================================
// Écritures
// ============================================================

function metaFields(updatedBy: string) {
  return { _updated_by: updatedBy, _updated_at: new Date().toISOString() };
}

/** Crée un local. Échoue si le code existe déjà (id immuable, unique). */
export async function createLocal(local: Local, createdBy: string): Promise<void> {
  const ref = adminDb().collection(COLLECTION).doc(local.id);
  await adminDb().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      throw new Error(`Le code de salle "${local.id}" existe déjà`);
    }
    const { id: _id, ...fields } = local;
    tx.set(ref, {
      ...fields,
      archived: Boolean(local.archived),
      _created_by: createdBy,
      _created_at: new Date().toISOString(),
      ...metaFields(createdBy),
    });
  });
  invalidateLocauxCache();
}

/** Met à jour des champs éditables d'un local existant. */
export async function updateLocal(
  id: string,
  fields: Partial<Pick<Local, LocalEditableField>>,
  updatedBy: string
): Promise<void> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && (LOCAL_EDITABLE_FIELDS as readonly string[]).includes(k)) {
      clean[k] = v;
    }
  }
  if (Object.keys(clean).length === 0) return;

  const ref = adminDb().collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    // Compat pré-migration : si la collection n'est pas encore peuplée,
    // matérialiser le local statique avant d'appliquer la modification.
    const current = await getLocal(id);
    if (!current) throw new Error(`Local "${id}" introuvable`);
    const { id: _id, ...base } = current;
    await ref.set({ ...base, ...clean, ...metaFields(updatedBy) });
  } else {
    await ref.set({ ...clean, ...metaFields(updatedBy) }, { merge: true });
  }
  invalidateLocauxCache();
}

/** Archive (soft delete) / restaure un local. */
export async function setLocalArchived(
  id: string,
  archived: boolean,
  updatedBy: string
): Promise<void> {
  const ref = adminDb().collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    const current = await getLocal(id);
    if (!current) throw new Error(`Local "${id}" introuvable`);
    const { id: _id, ...base } = current;
    await ref.set({ ...base, archived, ...metaFields(updatedBy) });
  } else {
    await ref.set({ archived, ...metaFields(updatedBy) }, { merge: true });
  }
  invalidateLocauxCache();
}

/** Suppression définitive (réservée superadmin — vérifiée côté route). */
export async function hardDeleteLocal(id: string): Promise<void> {
  await adminDb().collection(COLLECTION).doc(id).delete();
  invalidateLocauxCache();
}
