import { NextRequest, NextResponse } from "next/server";
import { getLocaux } from "@/lib/data";
import { listTempStickSensors } from "@/lib/tempstick";
import { matchAllSensors, getSensorsForRoom, loadOverrides } from "@/lib/sensor-match";

interface Props {
  params: Promise<{ salleId: string }>;
}

/**
 * GET /api/salles/[salleId]/sensors
 * Returns TempStick sensors associated with a room.
 */
export async function GET(_req: NextRequest, { params }: Props) {
  const { salleId } = await params;
  const decodedId = decodeURIComponent(salleId);

  try {
    const allLocaux = getLocaux({ includeArchived: true });
    const localIds = allLocaux.map((l) => l.id);

    // Validate room exists
    if (!localIds.includes(decodedId)) {
      return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
    }

    // Fetch sensors + overrides
    const [sensors, overrides] = await Promise.all([
      listTempStickSensors(),
      loadOverrides(),
    ]);

    const matched = matchAllSensors(sensors, localIds, overrides);
    const roomSensors = getSensorsForRoom(matched, decodedId);

    return NextResponse.json({
      local_id: decodedId,
      sensors: roomSensors.map((s) => ({
        sensor_id: s.sensor_id,
        sensor_name: s.sensor_name,
        last_temp_c: s.last_temp_c,
        last_humidity: s.last_humidity,
        last_checkin_utc: s.last_checkin_utc,
        offline: s.offline,
        battery: s.battery,
        match_source: s.match_source,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
