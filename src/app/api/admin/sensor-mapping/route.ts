import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getLocaux } from "@/lib/data";
import { listTempStickSensors, isTempStickConfigured } from "@/lib/tempstick";
import { matchAllSensors, loadOverrides } from "@/lib/sensor-match";

/**
 * GET /api/admin/sensor-mapping
 * Full diagnostic view of the sensor→room mapping (admin only).
 */
export async function GET() {
  try {
    await requireAdmin();

    if (!isTempStickConfigured()) {
      return NextResponse.json(
        { error: "TEMPSTICK_API_KEY non configurée" },
        { status: 503 }
      );
    }

    const allLocaux = getLocaux({ includeArchived: true });
    const localIds = allLocaux.map((l) => l.id);

    const [sensors, overrides] = await Promise.all([
      listTempStickSensors(),
      loadOverrides(),
    ]);

    const matched = matchAllSensors(sensors, localIds, overrides);

    const mappings = matched.map((s) => ({
      sensor_id: s.sensor_id,
      sensor_name: s.sensor_name,
      matched_local_id: s.matched_local_id,
      match_source: s.match_source,
      online: !s.offline,
      last_temp_c: s.last_temp_c,
      last_humidity: s.last_humidity,
      battery: s.battery,
      last_checkin_utc: s.last_checkin_utc,
    }));

    const unmatchedSensors = mappings.filter((m) => m.match_source === "none");
    const matchedRoomIds = new Set(
      mappings.filter((m) => m.matched_local_id).map((m) => m.matched_local_id)
    );

    return NextResponse.json({
      mappings,
      unmatched_sensors: unmatchedSensors,
      rooms_with_sensors: matchedRoomIds.size,
      rooms_without_sensors: localIds.length - matchedRoomIds.size,
      total_sensors: sensors.length,
      total_overrides: overrides.size,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
