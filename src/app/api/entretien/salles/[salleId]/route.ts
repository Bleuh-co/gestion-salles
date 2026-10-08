import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getLocal } from "@/lib/repo/locaux";
import { erreurEntretien, estGestionnaire } from "@/lib/entretien/routes";
import { vueSalle } from "@/lib/entretien/vues";

// ============================================================
// GET /api/entretien/salles/[salleId] — onglet « Entretien » d'une
// salle (V1) : ses règles, ses interventions, ses équipements. Les
// tâches GANDALF ouvertes de la salle sont relues au passage.
// ============================================================

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  try {
    const s = await requireSession();
    const { salleId } = await params;
    const local = await getLocal(decodeURIComponent(salleId));
    if (!local) return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
    const vue = await vueSalle(local.id);
    return NextResponse.json({ ...vue, gestionnaire: estGestionnaire(s), moi: s.email.toLowerCase() });
  } catch (e) {
    return erreurEntretien(e);
  }
}
