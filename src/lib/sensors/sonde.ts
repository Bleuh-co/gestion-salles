// ============================================================
// Capteurs TempStick à sonde (modèle « EX », conteneurs 1 à 4) : la
// sonde filaire mesure l'intérieur du congélateur, le boîtier reste
// dehors. Le boîtier rapporte sa propre température et son humidité
// (last_temp, last_humidity) et, à part, celle de la sonde
// (last_tcTemp ; tcTemp dans les relevés). Pour ces capteurs, la donnée
// de la salle est celle de la sonde : sa température, et aucune humidité
// (la sonde n'en mesure pas ; celle du boîtier serait l'air du dehors).
// Module pur : appelé par sensors/tempstick.ts.
// ============================================================

/** Température d'une sonde, ou null si absente ou hors de portée (-9999 = pas de sonde). */
export function temperatureSonde(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= -200 || n >= 1000) return null;
  return n;
}

function nombre(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Dernière mesure à afficher pour un capteur de /sensors/all. */
export function derniereMesure(s: Record<string, unknown>): { c: number | null; h: number | null; sonde: boolean } {
  const sonde = temperatureSonde(s.last_tcTemp);
  if (sonde != null) return { c: sonde, h: null, sonde: true };
  return { c: nombre(s.last_temp), h: nombre(s.last_humidity), sonde: false };
}

/**
 * Relevés d'un capteur (/sensor/{id}/readings) ramenés à { c, h }. Si un
 * seul relevé porte une sonde, le capteur en a une : tous ses relevés
 * prennent la sonde, et un relevé sans sonde reste vide plutôt que de
 * mêler la température du boîtier à celle du congélateur.
 */
export function mesuresDesReleves(raw: Record<string, unknown>[]): { c: number | null; h: number | null }[] {
  const avecSonde = raw.some((r) => temperatureSonde(r?.tcTemp) != null);
  return raw.map((r) =>
    avecSonde
      ? { c: temperatureSonde(r?.tcTemp), h: null }
      : { c: nombre(r?.temperature), h: nombre(r?.humidity) },
  );
}
