import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getAllActifs } from "@/lib/repo/actifs";
import { getLocaux } from "@/lib/repo/locaux";
import { getConfigEntretien } from "@/lib/repo/entretien";
import { erreurEntretien } from "@/lib/entretien/routes";

// GET /api/entretien/options — équipements, salles et listes de choix des
// fenêtres de l'entretien (ajouter un entretien, signaler un problème).

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    const [actifs, locaux, cfg] = await Promise.all([getAllActifs(), getLocaux(), getConfigEntretien()]);
    return NextResponse.json({
      actifs: actifs.map((a) => ({ id: a.id, nom: a.nom, matricule: a.matricule, idSalle: a.idSalle, criticite: a.criticite, idMasterlist: a.idMasterlist })),
      salles: locaux.map((l) => ({ id: l.id, nomSalle: l.nomSalle })),
      listes: cfg.listes,
    });
  } catch (e) {
    return erreurEntretien(e);
  }
}
