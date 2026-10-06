// ============================================================
// Rapprochement capteur → salle (module pur, sans Firestore).
//
// Ordre :
//   1. choix manuel d'un administrateur (sensor_overrides) ;
//   2. rapprochement par le nom, inchangé (exact, suffixe, préfixe) ;
//   3. rapprochement tolérant, seulement si 2 n'a rien trouvé :
//      ponctuation, tirets et parenthèses ignorés, « C » final séparé
//      accepté (« Sechoir 1 Zone Multi C » → « SÉCHOIR 1 - ZONE MULTI »,
//      « Zone Multi 5 (chambre froide) » → « ZONE MULTI 5 »).
//      Comme il ne s'applique qu'aux capteurs sans salle, il ne
//      change aucun rattachement existant.
// ============================================================

/**
 * Strip diacritics (accents) from a string.
 * e.g. "ENTREPÔT" → "ENTREPOT", "SÉCHOIR" → "SECHOIR"
 */
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Normalise a string for fuzzy comparison:
 *   1. Uppercase
 *   2. Strip accents
 *   3. Collapse whitespace
 *   4. Trim
 */
export function normalise(s: string): string {
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
export function stripSensorSuffix(s: string): string {
  // Match: digit immediately followed by a single letter at end-of-string
  const m = s.match(/^(.+\d)[A-Za-z]$/);
  if (m && m[1].length >= 3) return m[1];
  return s;
}

/** Normalisation tolérante : parenthèses retirées, tout ce qui n'est ni lettre ni chiffre → espace. */
export function normaliseTolerant(s: string): string {
  return stripAccents(s)
    .toUpperCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Suffixe tolérant : « 4C », « 4 C » ou « … MULTI C » (lettre seule à la fin). */
function stripSuffixTolerant(s: string): string {
  let m = s.match(/^(.+\d) ?[A-Z]$/);
  if (m && m[1].length >= 3) return m[1];
  m = s.match(/^(.+) [A-Z]$/);
  return m && m[1].length >= 3 ? m[1] : s;
}

// ---- Auto-matching --------------------------------------------------------

/** Rapprochement historique (inchangé) : exact, sans suffixe, puis par préfixe. */
function matchStrict(sensorName: string, localIds: string[]): string | null {
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

/** Rapprochement tolérant : clé normalisée unique uniquement (une clé partagée par deux salles est ignorée). */
function matchTolerant(sensorName: string, localIds: string[]): string | null {
  const map = new Map<string, string | null>();
  for (const id of localIds) {
    const k = normaliseTolerant(id);
    if (!k) continue;
    map.set(k, map.has(k) && map.get(k) !== id ? null : id);
  }
  const n = normaliseTolerant(sensorName);
  for (const k of [n, stripSuffixTolerant(n)]) {
    const hit = map.get(k);
    if (hit) return hit;
  }
  return null;
}

/**
 * Try to match a sensor_name to one of the known local IDs.
 * Returns the matched local.id or null.
 */
export function matchSensorToRoom(sensorName: string, localIds: string[]): string | null {
  if (!sensorName) return null;
  return matchStrict(sensorName, localIds) ?? matchTolerant(sensorName, localIds);
}

// ---- Combined matching (overrides + auto) ---------------------------------

export interface RawSensor {
  sensor_id: string;
  sensor_name: string | null;
  last_temp_c: number | null;
  last_humidity: number | null;
  last_checkin_utc: string | null;
  offline: boolean;
  battery: number | null;
  /** Id du fournisseur (ex. "tempstick") — voir src/lib/sensors/. */
  provider?: string;
  /** Création du capteur chez le fournisseur (UTC). */
  created_utc?: string | null;
  /** Intervalle d'envoi des relevés, en secondes. */
  send_interval_s?: number | null;
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
    // 1. Check override ("" = retiré par un administrateur : aucune salle, même si le nom correspond)
    const overrideId = overrides.get(s.sensor_id);
    if (overrideId === "") {
      return { ...s, matched_local_id: null, match_source: "none" as const };
    }
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
