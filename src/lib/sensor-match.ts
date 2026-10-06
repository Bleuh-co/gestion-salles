import "server-only";

import { adminDb } from "./firebase-admin";

// ============================================================
// Sensor → Room matching engine
//
// Priority:
//   1. Admin overrides from Firestore (sensor_overrides collection)
//   2. Auto-match by normalised sensor_name → local.id
// ============================================================

const OVERRIDES_COLLECTION = "sensor_overrides";

// Le rapprochement par le nom vit dans sensor-match-core.ts (module pur,
// testé par node --test) ; ce fichier garde la partie Firestore.
export {
  matchSensorToRoom,
  matchAllSensors,
  getSensorsForRoom,
  type RawSensor,
  type MatchedSensor,
} from "./sensor-match-core";

// ---- Overrides (Firestore) ------------------------------------------------

export interface SensorOverride {
  sensor_id: string;
  local_id: string;
  updated_by?: string;
  updated_at?: string;
}

/**
 * Load all admin overrides from Firestore.
 * Returns a map: sensor_id → local_id ("" = capteur retiré par un administrateur).
 */
export async function loadOverrides(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const o of await loadOverridesDetail()) map.set(o.sensor_id, o.local_id);
  return map;
}

/** Choix manuels avec leur auteur et leur date (Administration › Capteurs). */
export async function loadOverridesDetail(): Promise<(SensorOverride & { retire: boolean })[]> {
  const db = adminDb();
  const snap = await db.collection(OVERRIDES_COLLECTION).get();
  const out: (SensorOverride & { retire: boolean })[] = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    const retire = data.retire === true;
    if (retire || (data.local_id && typeof data.local_id === "string")) {
      out.push({
        sensor_id: doc.id,
        local_id: retire ? "" : data.local_id,
        updated_by: data.updated_by,
        updated_at: data.updated_at,
        retire,
      });
    }
  }
  return out;
}

/** Marque un capteur « retiré » : il ne se rattache plus à aucune salle, même par son nom. */
export async function saveRetrait(sensorId: string, updatedBy: string): Promise<void> {
  await adminDb().collection(OVERRIDES_COLLECTION).doc(sensorId).set({
    local_id: "",
    retire: true,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Save an override.
 */
export async function saveOverride(
  sensorId: string,
  localId: string,
  updatedBy: string
): Promise<void> {
  const db = adminDb();
  await db.collection(OVERRIDES_COLLECTION).doc(sensorId).set({
    local_id: localId,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Delete an override.
 */
export async function deleteOverride(sensorId: string): Promise<void> {
  const db = adminDb();
  await db.collection(OVERRIDES_COLLECTION).doc(sensorId).delete();
}
