import { getLocaux, getUniqueFamilles, getUniqueEtages, getStats } from "@/lib/data";
import { getSession } from "@/lib/auth-server";
import { SallesPageClient } from "@/components/SallesPageClient";
import { loadLocauxOverrides, mergeOverrides } from "@/lib/locaux-overrides";
import { listTempStickSensors } from "@/lib/tempstick";
import { matchAllSensors } from "@/lib/sensor-match";
import { loadOverrides as loadSensorOverrides } from "@/lib/sensor-match";

export type SensorSummary = { temp: number | null; humidity: number | null; offline: boolean };

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gestion des Salles — ChanvHQ",
  description: "Vue d'ensemble des locaux de l'usine ChanvHQ du Groupe Chanv.",
};

export default async function SallesPage() {
  const baseLocaux = getLocaux();
  const overrides = await loadLocauxOverrides();
  const locaux = mergeOverrides(baseLocaux, overrides);
  const familles = getUniqueFamilles();
  const etages = getUniqueEtages();
  const stats = getStats();
  const session = await getSession();
  const isAdmin = session?.role === "admin" || session?.role === "superadmin";

  // Fetch sensor data and build per-room summary
  const sensorMap: Record<string, SensorSummary> = {};
  try {
    const [sensors, sensorOverrides] = await Promise.all([
      listTempStickSensors(),
      loadSensorOverrides(),
    ]);
    const localIds = locaux.map((l) => l.id);
    const matched = matchAllSensors(sensors, localIds, sensorOverrides);
    for (const s of matched) {
      if (!s.matched_local_id) continue;
      // Keep the most recent / non-offline sensor per room
      const existing = sensorMap[s.matched_local_id];
      if (!existing || (!s.offline && existing.offline)) {
        sensorMap[s.matched_local_id] = {
          temp: s.last_temp_c,
          humidity: s.last_humidity,
          offline: s.offline,
        };
      }
    }
  } catch (e) {
    console.warn("[salles] TempStick fetch failed:", e);
  }

  return (
    <SallesPageClient
      locaux={locaux}
      familles={familles}
      etages={etages}
      stats={stats}
      isAdmin={isAdmin}
      sensorMap={sensorMap}
    />
  );
}

