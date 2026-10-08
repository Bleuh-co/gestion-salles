import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { erreurEntretien, estGestionnaire } from "@/lib/entretien/routes";
import { vueActif } from "@/lib/entretien/vues";

// GET /api/entretien/actifs/[actifId] — page d'un équipement (V2).

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ actifId: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  try {
    const s = await requireSession();
    const { actifId } = await params;
    const vue = await vueActif(decodeURIComponent(actifId));
    if (!vue) return NextResponse.json({ error: "Équipement introuvable" }, { status: 404 });
    return NextResponse.json({ ...vue, gestionnaire: estGestionnaire(s) });
  } catch (e) {
    return erreurEntretien(e);
  }
}
