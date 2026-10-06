import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { listAllSensors } from "@/lib/sensors";
import { historiqueComplet } from "@/lib/repo/releves";
import { parJour } from "@/lib/registre/mesures";
import { proposerDatePose } from "@/lib/registre/rattachement";
import { jourDe, lireHeureUtc } from "@/lib/registre/temps";
import { reponseErreur } from "@/lib/registre/routes";

// ============================================================
// GET /api/admin/rattachements/proposition?sensorId=… (admin+)
// Date de pose proposée d'après les mesures (bascule de température),
// et minimum / maximum par jour depuis la création du capteur pour
// que la personne voie d'elle-même quand il a changé de place.
// ============================================================

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sensorId = req.nextUrl.searchParams.get("sensorId") || "";
    const capteur = (await listAllSensors()).find((s) => s.sensor_id === sensorId);
    if (!capteur) return NextResponse.json({ error: "Capteur introuvable" }, { status: 404 });
    const releves = await historiqueComplet(capteur);
    const propose = proposerDatePose(releves, jourDe);
    return NextResponse.json({
      sensorId,
      cree: lireHeureUtc(capteur.created_utc ?? null),
      propose,
      releves: releves.length,
      jours: parJour(releves, "c").map((j) => ({ jour: j.jour, min: j.min, max: j.max })),
    });
  } catch (e) {
    return reponseErreur(e);
  }
}
