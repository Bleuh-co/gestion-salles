import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getFamilleColors, saveFamilleColors } from "@/lib/repo/config";

export const runtime = "nodejs";

/**
 * GET — retourne les couleurs actuelles (Firestore config/familles + fallback)
 */
export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const colors = await getFamilleColors();
  return NextResponse.json({ colors, source: "firestore" });
}

/**
 * POST — sauvegarde les couleurs dans Firestore (config/familles)
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
    await saveFamilleColors(colors, session.email);
    return NextResponse.json({ status: "ok", saved: colors });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
