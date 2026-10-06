import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { loadOverrides, deleteOverride } from "@/lib/sensor-match";
import { getLocal } from "@/lib/repo/locaux";
import { rattacher } from "@/lib/repo/rattachements";
import { listAllSensors } from "@/lib/sensors";
import { auteurDe } from "@/lib/registre/routes";

/**
 * GET /api/admin/sensor-overrides
 * List all sensor→room overrides (admin only).
 */
export async function GET() {
  try {
    await requireAdmin();
    const overrides = await loadOverrides();
    const list = Array.from(overrides.entries()).map(([sensorId, localId]) => ({
      sensor_id: sensorId,
      local_id: localId,
    }));
    return NextResponse.json({ overrides: list });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/sensor-overrides
 * Create or update an override: { sensor_id, local_id }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const { sensor_id, local_id } = body;

    if (
      !sensor_id ||
      typeof sensor_id !== "string" ||
      !local_id ||
      typeof local_id !== "string"
    ) {
      return NextResponse.json(
        { error: "sensor_id et local_id (string) requis" },
        { status: 400 }
      );
    }

    // Validate lengths to prevent abuse
    if (sensor_id.length > 200 || local_id.length > 200) {
      return NextResponse.json(
        { error: "Valeurs trop longues" },
        { status: 400 }
      );
    }

    if (!(await getLocal(local_id))) {
      return NextResponse.json({ error: "Local introuvable" }, { status: 400 });
    }
    // Rattachement daté à partir de maintenant (le passé du capteur reste où il était).
    const capteur = (await listAllSensors()).find((s) => s.sensor_id === sensor_id);
    await rattacher({
      sensorId: sensor_id,
      sensorName: capteur?.sensor_name || sensor_id,
      provider: capteur?.provider,
      salleId: local_id,
      du: Date.now(),
      par: await auteurDe(session),
    });

    return NextResponse.json({
      status: "success",
      sensor_id,
      local_id,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/sensor-overrides
 * Remove an override: { sensor_id }
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { sensor_id } = body;

    if (!sensor_id || typeof sensor_id !== "string") {
      return NextResponse.json(
        { error: "sensor_id (string) requis" },
        { status: 400 }
      );
    }

    await deleteOverride(sensor_id);

    return NextResponse.json({ status: "deleted", sensor_id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
