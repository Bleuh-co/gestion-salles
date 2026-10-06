import "server-only";

import type { ProviderReading, ProviderSensor, SensorProvider } from "./provider";
import { ajouterJours, lireHeureUtc } from "@/lib/registre/temps";

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
      created_utc: (s.created as string) || null,
      send_interval_s: Number(s.send_interval) > 0 ? Number(s.send_interval) : null,
    }));

    _cache = { sensors, at: Date.now() };
    return sensors;
  } catch (e) {
    console.warn("[tempstick] listSensors failed", e);
    return _cache?.sensors || [];
  }
}

function nombre(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Historique d'un capteur (GET /sensor/{id}/readings). TempStick garde
 * tout depuis la pose (mesuré le 6 octobre 2026 : relevés du 19 mars
 * encore disponibles). Les heures rendues (sensor_time) sont en UTC ;
 * on élargit la demande d'un jour de chaque côté et on laisse
 * l'appelant couper aux bornes exactes.
 */
async function readings(sensorId: string, jourDebut: string, jourFin: string): Promise<ProviderReading[]> {
  const key = getApiKey();
  if (!key) throw new Error("TEMPSTICK_API_KEY absente");
  const qs = new URLSearchParams({
    offset: "-14400",
    setting: "custom",
    start: ajouterJours(jourDebut, -1),
    end: ajouterJours(jourFin, 1),
  });
  const res = await fetch(`${API_BASE}/sensor/${encodeURIComponent(sensorId)}/readings?${qs}`, {
    headers: { "X-API-Key": key, Accept: "application/json", "User-Agent": "GestionSalles/1.0" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`TempStick ${res.status} (relevés ${sensorId}) : ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  const data = await res.json();
  if (data?.type === "error") throw new Error(`TempStick : ${data.message || "erreur"}`);
  const raw = data?.data?.readings ?? data?.data ?? [];
  const out: ProviderReading[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const t = lireHeureUtc(r?.sensor_time ?? r?.created);
    if (t == null) continue;
    out.push({ t, c: nombre(r?.temperature), h: nombre(r?.humidity) });
  }
  return out.sort((a, b) => a.t - b.t);
}

export const tempStickProvider: SensorProvider = {
  id: PROVIDER_ID,
  label: "Temp Stick",
  isConfigured: () => !!getApiKey(),
  listSensors,
  readings,
};
