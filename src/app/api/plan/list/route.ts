import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { listTempStickSensors, isTempStickConfigured } from "@/lib/tempstick";

const PLANS_COLLECTION = "plans";

export async function GET() {
  try {
    const db = adminDb();

    // List available plans
    const snap = await db.collection(PLANS_COLLECTION).get();
    if (snap.empty) {
      return NextResponse.json({ plans: [] });
    }

    const plans = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name || doc.id,
          order: d.order ?? 999,
          has_image: !!d.image_url,
          sensor_count: d.sensor_positions ? Object.keys(d.sensor_positions).length : 0,
          room_count: d.room_positions ? Object.keys(d.room_positions).length : 0,
        };
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

    return NextResponse.json({ plans });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
