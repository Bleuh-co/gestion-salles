import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { listTempStickSensors, isTempStickConfigured } from "@/lib/tempstick";

const PLANS_COLLECTION = "plans";

interface Props {
  params: Promise<{ planId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { planId } = await params;

  try {
    const db = adminDb();
    const doc = await db.collection(PLANS_COLLECTION).doc(planId).get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    const d = doc.data() || {};

    // Temp Stick sensors
    let sensors: unknown[] = [];
    let sensorsError: string | null = null;
    if (isTempStickConfigured()) {
      try {
        sensors = await listTempStickSensors();
      } catch (e: unknown) {
        sensorsError = e instanceof Error ? e.message : "Erreur Temp Stick";
      }
    } else {
      sensorsError = "TEMPSTICK_API_KEY non configurée";
    }

    // Sensor overrides (admin-assigned sensor→room mappings)
    const overridesSnap = await db.collection("sensor_overrides").get();
    const sensorOverrides: Record<string, string> = {};
    for (const odoc of overridesSnap.docs) {
      const odata = odoc.data();
      if (odata.local_id && typeof odata.local_id === "string") {
        sensorOverrides[odoc.id] = odata.local_id;
      }
    }

    return NextResponse.json({
      plan_id: doc.id,
      plan_name: d.name || doc.id,
      image_url: d.image_url || null,
      image_width: d.image_width || null,
      image_height: d.image_height || null,
      sensor_positions: d.sensor_positions || {},
      room_positions: d.room_positions || {},
      sensors,
      sensor_overrides: sensorOverrides,
      sensors_error: sensorsError,
      fetched_at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
