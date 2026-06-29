import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { readFamilleColors, writeFamilleColors } from "@/lib/sheets-sync";
import { FAMILLE_COLORS_FALLBACK } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET — retourne les couleurs actuelles (sheet + fallback)
 */
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let sheetColors: Record<string, string> = {};
  try {
    sheetColors = await readFamilleColors();
  } catch {
    // Sheet non dispo, on utilise le fallback
  }

  // Merge: sheet prend priorité sur fallback
  const merged = { ...FAMILLE_COLORS_FALLBACK, ...sheetColors };

  return NextResponse.json({
    colors: merged,
    source: Object.keys(sheetColors).length > 0 ? "sheet" : "fallback",
  });
}

/**
 * POST — sauvegarde les couleurs dans le sheet ET retourne le résultat
 * Body: { colors: { "CANNABIS": "#185abc", ... } }
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const body = await req.json();
  const colors = body?.colors as Record<string, string> | undefined;

  if (!colors || typeof colors !== "object") {
    return NextResponse.json({ error: "Format invalide. Attendu: { colors: { famille: '#hex' } }" }, { status: 400 });
  }

  // Valider les couleurs hex
  for (const [famille, hex] of Object.entries(colors)) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      return NextResponse.json(
        { error: `Couleur invalide pour ${famille}: ${hex}. Format attendu: #rrggbb` },
        { status: 400 }
      );
    }
  }

  try {
    await writeFamilleColors(colors);
    return NextResponse.json({ status: "ok", saved: colors });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
