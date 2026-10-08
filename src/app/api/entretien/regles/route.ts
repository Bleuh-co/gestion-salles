import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { creerRegle, getRegles } from "@/lib/repo/entretien";
import { lireRegle, MESSAGES_REGLE } from "@/lib/entretien/saisie";
import { acteurDe, erreurEntretien } from "@/lib/entretien/routes";
import { contexte, inscrireRegle } from "@/lib/entretien/service";

// ============================================================
// GET  /api/entretien/regles (gestionnaire+) — toutes les règles.
// POST /api/entretien/regles (gestionnaire+) — « Ajouter un entretien » (V3).
//   Une règle sans fréquence, sans prochaine date ou sans personne est
//   « à compléter » : elle s'affiche, mais ne crée aucune tâche.
// ============================================================

export const dynamic = "force-dynamic";


export async function GET() {
  try {
    await requireGestionnaire();
    return NextResponse.json({ regles: await getRegles() });
  } catch (e) {
    return erreurEntretien(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireGestionnaire();
    const lu = lireRegle(await req.json().catch(() => null));
    if ("erreur" in lu) return NextResponse.json({ error: MESSAGES_REGLE[lu.erreur], code: lu.erreur }, { status: 400 });
    const par = await acteurDe(s);
    const regle = await creerRegle(
      { ...lu.regle, etat: lu.complete ? "active" : "a_completer", origine: { source: "app", refs: [] } },
      par.email
    );
    await inscrireRegle(regle, "entretien_ajoute", par, await contexte());
    return NextResponse.json({ status: "success", regle });
  } catch (e) {
    return erreurEntretien(e);
  }
}
