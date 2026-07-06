import "server-only";

import type { ProviderSensor, SensorProvider } from "./provider";

// ============================================================
// Fournisseur TempStick — capteurs température/humidité
// (tempstickapi.com, même API que Apps-Hub).
// ============================================================

const API_BASE = "https://tempstickapi.com/api/v1";
const PROVIDER_ID = "tempstick";

function getApiKey(): string | null {
  return process.env.TEMPSTICK_API_KEY || null;
}

// Cache (30s)
let _cache: { sensors: ProviderSensor[]; at: number } | null = null;
const TTL = 30_000;

async function listSensors(): Promise<ProviderSensor[]> {
  const key = getApiKey();
  if (!key) return [];

  if (_cache && Date.now() - _cache.at < TTL) return _cache.sensors;

  try {
    const res = await fetch(`${API_BASE}/sensors/all`, {
      headers: {
        "X-API-Key": key,
        Accept: "application/json",
        "User-Agent": "GestionSalles/1.0",
      },
    });

    if (!res.ok) {
      console.warn(`[tempstick] ${res.status}: ${await res.text().catch(() => "")}`);
      return _cache?.sensors || [];
    }

    const data = await res.json();
    const items = data?.data?.items || data?.data || [];
    const arr = Array.isArray(items) ? items : [];

    const sensors: ProviderSensor[] = arr.map((s: Record<string, unknown>) => ({
      sensor_id: String(s.sensor_id || ""),
      sensor_name: (s.sensor_name as string) || null,
      last_temp_c: s.last_temp != null ? Number(s.last_temp) : null,
      last_humidity: s.last_humidity != null ? Number(s.last_humidity) : null,
      last_checkin_utc: (s.last_checkin as string) || null,
      offline: s.offline === 1 || s.offline === true,
      battery: (s.battery_pct as number) || (s.battery as number) || null,
      provider: PROVIDER_ID,
    }));

    _cache = { sensors, at: Date.now() };
    return sensors;
  } catch (e) {
    console.warn("[tempstick] listSensors failed", e);
    return _cache?.sensors || [];
  }
}

export const tempStickProvider: SensorProvider = {
  id: PROVIDER_ID,
  label: "Temp Stick",
  isConfigured: () => !!getApiKey(),
  listSensors,
};
