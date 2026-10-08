import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getReprise } from "@/lib/repo/entretien";
import { erreurEntretien } from "@/lib/entretien/routes";

// GET /api/entretien/reprise (administrateurs) — la séance de reprise de la GMAO (V11).

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ lignes: await getReprise() });
  } catch (e) {
    return erreurEntretien(e);
  }
}
