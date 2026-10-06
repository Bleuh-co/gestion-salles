import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { getLocal } from "@/lib/repo/locaux";
import { cibleSalle, inscrireGeste } from "@/lib/repo/registre";
import { lireNote } from "@/lib/registre/notes";
import { auteurDe, reponseErreur } from "@/lib/registre/routes";

// ============================================================
// POST /api/salles/[salleId]/notes (gestionnaire+) — lot 5
//   { categorie: intervention|nettoyage|degivrage|observation, texte, jour?, heure? }
// Une note faite sur place (fiche ou téléphone après le code QR),
// datée du moment du fait (heure de Montréal ; défaut : maintenant).
// ============================================================

interface Props {
  params: Promise<{ salleId: string }>;
}

const MESSAGES = {
  categorie: "Sorte de note attendue : intervention, nettoyage, dégivrage ou observation",
  texte: "La note est vide",
  quand: "Moment invalide : pas dans le futur, au plus un an en arrière",
  ecart: "Écart invalide",
} as const;

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const session = await requireGestionnaire();
    const { salleId } = await params;
    const local = await getLocal(decodeURIComponent(salleId));
    if (!local) return NextResponse.json({ error: "Local introuvable" }, { status: 404 });

    const n = lireNote(await req.json().catch(() => ({})), Date.now());
    if ("erreur" in n) return NextResponse.json({ error: MESSAGES[n.erreur], code: n.erreur }, { status: 400 });

    await inscrireGeste([
      {
        salleId: local.id,
        action: "note",
        at: new Date(n.t).toISOString(),
        par: await auteurDe(session),
        cible: cibleSalle(local),
        note: n.texte,
        details: { categorie: n.categorie },
      },
    ]);
    return NextResponse.json({ status: "success" });
  } catch (e) {
    return reponseErreur(e);
  }
}
