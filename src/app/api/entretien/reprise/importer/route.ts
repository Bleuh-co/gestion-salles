import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { importerReprise } from "@/lib/entretien/import-reprise";
import { acteurDe, erreurEntretien } from "@/lib/entretien/routes";

// POST /api/entretien/reprise/importer (administrateurs) — « Importer ce qui est décidé » (lot 0).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const s = await requireAdmin();
    const bilan = await importerReprise(await acteurDe(s));
    return NextResponse.json({ status: "success", bilan });
  } catch (e) {
    return erreurEntretien(e);
  }
}
