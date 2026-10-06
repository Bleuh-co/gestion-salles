import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getLocaux } from "@/lib/repo/locaux";
import { registreGlobal } from "@/lib/registre/service";
import { bornesPeriode } from "@/lib/registre/periode";
import { debutJour } from "@/lib/registre/temps";
import { OUVERTURE_DONNEES } from "@/lib/registre/temps";
import { reponseErreur } from "@/lib/registre/routes";

// ============================================================
// GET /api/admin/registre?periode|du&au&famille&salle (admin+) — V10
// Le registre de plusieurs salles : lignes écrites, capteurs posés,
// partis ou nouveaux. Remplace l'ancien « Journal » de l'administration.
// ============================================================

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const maintenant = Date.now();
    const bornes = bornesPeriode(sp.get("periode") || (sp.get("du") ? "perso" : "30j"), sp.get("du"), sp.get("au"), maintenant, debutJour(OUVERTURE_DONNEES));
    const locaux = await getLocaux({ includeArchived: true });
    const famille = sp.get("famille");
    const salle = sp.get("salle");
    const ids = locaux
      .filter((l) => (!famille || l.famille === famille) && (!salle || l.id === salle))
      .map((l) => l.id);
    const lignes = await registreGlobal(bornes.du, bornes.au, ids);
    // Lignes sans salle (capteur posé chez le fournisseur sans rattachement) : seulement sans filtre de salle.
    const visibles = famille || salle ? lignes.filter((l) => l.salleId) : lignes;
    return NextResponse.json({
      bornes,
      lignes: visibles.slice(0, 2000),
      tronque: visibles.length > 2000,
      noms: Object.fromEntries(locaux.map((l) => [l.id, l.nomSalle])),
    });
  } catch (e) {
    return reponseErreur(e);
  }
}
