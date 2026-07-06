import "server-only";

import { adminDb } from "./firebase-admin";
import type { Local } from "./types";

// ============================================================
// Firestore overrides for local/room data — LEGACY
//
// ⚠️ Remplacé par la collection "locaux" (src/lib/repo/locaux.ts),
// devenue la source de vérité. Ce module ne sert plus qu'à :
//   1. la migration (/api/admin/migrate-firestore) qui fusionne
//      ces overrides dans la collection "locaux"
//   2. le fallback pré-migration du repo
//
// Collection: "locaux_overrides"
//   doc id = local.id (e.g. "ZONE MULTI 4")
// ============================================================

const LOCAUX_OVERRIDES = "locaux_overrides";

export type LocalOverrideFields = Partial<
  Pick<Local, "nomSalle" | "statut" | "conditions" | "niveauAcces" | "vocation" | "prod">
>;

/**
 * Load all overrides from Firestore.
 * Returns a map: local.id → partial Local fields
 */
export async function loadLocauxOverrides(): Promise<Map<string, LocalOverrideFields>> {
  const db = adminDb();
  const snap = await db.collection(LOCAUX_OVERRIDES).get();
  const map = new Map<string, LocalOverrideFields>();
  for (const doc of snap.docs) {
    const data = doc.data() as LocalOverrideFields;
    map.set(doc.id, data);
  }
  return map;
}

/**
 * Load override for a single local.
 */
export async function loadLocalOverride(localId: string): Promise<LocalOverrideFields | null> {
  const db = adminDb();
  const doc = await db.collection(LOCAUX_OVERRIDES).doc(localId).get();
  if (!doc.exists) return null;
  return doc.data() as LocalOverrideFields;
}

/**
 * Save an override for a local. Merges with existing overrides.
 */
export async function saveLocalOverride(
  localId: string,
  fields: LocalOverrideFields,
  updatedBy: string
): Promise<void> {
  const db = adminDb();

  // Clean undefined values
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) clean[k] = v;
  }

  await db.collection(LOCAUX_OVERRIDES).doc(localId).set(
    {
      ...clean,
      _updated_by: updatedBy,
      _updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Apply Firestore overrides on top of static data.
 * Returns a new array — does not mutate the input.
 */
export function mergeOverrides(
  locaux: Local[],
  overrides: Map<string, LocalOverrideFields>
): Local[] {
  if (overrides.size === 0) return locaux;
  return locaux.map((l) => {
    const ov = overrides.get(l.id);
    if (!ov) return l;
    return { ...l, ...ov };
  });
}
