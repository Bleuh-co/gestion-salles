import { NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { erreurEntretien } from "@/lib/entretien/routes";
import { vueCalendrier } from "@/lib/entretien/vues";

// GET /api/entretien/calendrier (gestionnaire+) — les 12 prochains mois (V7).

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireGestionnaire();
    return NextResponse.json(await vueCalendrier());
  } catch (e) {
    return erreurEntretien(e);
  }
}
