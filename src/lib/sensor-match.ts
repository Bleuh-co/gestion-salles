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

// ---- Normalisation helpers ------------------------------------------------

/**
 * Strip diacritics (accents) from a string.
 * e.g. "ENTREPÔT" → "ENTREPOT", "SÉCHOIR" → "SECHOIR"
 */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalise a string for fuzzy comparison:
 *   1. Uppercase
 *   2. Strip accents
 *   3. Collapse whitespace
 *   4. Trim
 */
function normalise(s: string): string {
  return stripAccents(s).toUpperCase().replace(/\s+/g, " ").trim();
}

/**
 * Remove trailing sensor-instance suffixes (A, B, C, D, …) that TempStick
 * users append to distinguish multiple sensors in the same room.
 * e.g. "Zone Multi 4C" → "Zone Multi 4"
 *      "Entrepôt 2A"   → "Entrepôt 2"
 *      "SAS1"          → "SAS1" (no trailing letter after digit — keep as-is)
 *
 * Rule: only strip a single trailing letter [A-Z] that immediately follows
 * a digit AND the remaining string must still be ≥ 3 chars.
 */
function stripSensorSuffix(s: string): string {
  // Match: digit immediately followed by a single letter at end-of-string
  const m = s.match(/^(.+\d)[A-Za-z]$/);
  if (m && m[1].length >= 3) return m[1];
  return s;
}

// ---- Auto-matching --------------------------------------------------------

/**
 * Try to match a sensor_name to one of the known local IDs.
 * Returns the matched local.id or null.
 */
export function matchSensorToRoom(
  sensorName: string,
  localIds: string[]
): string | null {
  if (!sensorName) return null;

  // Build a lookup map:  normalised-id → original-id
  const normMap = new Map<string, string>();
  for (const id of localIds) {
    normMap.set(normalise(id), id);
  }

  // Attempt 1: exact normalised match
  const normSensor = normalise(sensorName);
  if (normMap.has(normSensor)) return normMap.get(normSensor)!;

  // Attempt 2: strip sensor suffix then match
  const stripped = normalise(stripSensorSuffix(sensorName));
  if (normMap.has(stripped)) return normMap.get(stripped)!;

  // Attempt 3: sensor names may use "Multi" vs ID that has "MULTI",
  // or different hyphenation — try contains-based matching.
  // Pick the best match where the normalised sensor name is a prefix of a local ID.
  // This handles cases like sensor "ZONE MULTI 4" matching "ZONE MULTI 4" exactly
  // but also lets "SECHOIR 1" match "SECHOIR 1 - ZONE MULTI" if no exact match.
  // We prefer longer matches to avoid false positives.
  let bestMatch: string | null = null;
  let bestLen = 0;
  for (const [normId, origId] of normMap) {
    if (normId.startsWith(stripped) && stripped.length >= 4 && normId.length > bestLen) {
      bestMatch = origId;
      bestLen = normId.length;
    }
  }
  // Only accept prefix match if the stripped name covers a significant portion of the ID
  if (bestMatch && stripped.length >= bestLen * 0.6) {
    return bestMatch;
  }

  return null;
}

// ---- Overrides (Firestore) ------------------------------------------------

export interface SensorOverride {
  sensor_id: string;
  local_id: string;
  updated_by?: string;
  updated_at?: string;
}

/**
 * Load all admin overrides from Firestore.
 * Returns a map: sensor_id → local_id
 */
export async function loadOverrides(): Promise<Map<string, string>> {
  const db = adminDb();
  const snap = await db.collection(OVERRIDES_COLLECTION).get();
  const map = new Map<string, string>();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.local_id && typeof data.local_id === "string") {
      map.set(doc.id, data.local_id);
    }
  }
  return map;
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

// ---- Combined matching (overrides + auto) ---------------------------------

interface RawSensor {
  sensor_id: string;
  sensor_name: string | null;
  last_temp_c: number | null;
  last_humidity: number | null;
  last_checkin_utc: string | null;
  offline: boolean;
  battery: number | null;
}

export interface MatchedSensor extends RawSensor {
  matched_local_id: string | null;
  match_source: "auto" | "override" | "none";
}

/**
 * Match all sensors to rooms using overrides first, then auto-match.
 */
export function matchAllSensors(
  sensors: RawSensor[],
  localIds: string[],
  overrides: Map<string, string>
): MatchedSensor[] {
  return sensors.map((s) => {
    // 1. Check override
    const overrideId = overrides.get(s.sensor_id);
    if (overrideId && localIds.includes(overrideId)) {
      return { ...s, matched_local_id: overrideId, match_source: "override" as const };
    }

    // 2. Auto-match by name
    const autoMatch = matchSensorToRoom(s.sensor_name || "", localIds);
    if (autoMatch) {
      return { ...s, matched_local_id: autoMatch, match_source: "auto" as const };
    }

    return { ...s, matched_local_id: null, match_source: "none" as const };
  });
}

/**
 * Get sensors for a specific room.
 */
export function getSensorsForRoom(
  matchedSensors: MatchedSensor[],
  localId: string
): MatchedSensor[] {
  return matchedSensors.filter((s) => s.matched_local_id === localId);
}
