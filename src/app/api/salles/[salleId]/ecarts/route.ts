import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { inscrireGeste } from "@/lib/repo/registre";
import { lireJustification } from "@/lib/registre/notes";
import { auteurDe, reponseErreur } from "@/lib/registre/routes";
import { chargerSalle } from "@/lib/registre/service";
import { jourDe } from "@/lib/registre/temps";

// ============================================================
// POST /api/salles/[salleId]/ecarts (gestionnaire+) — lot 5
//   { sensorId, grandeur: "c"|"h", debut (ms), texte }
// Justifie un écart. L'écart n'est pas écrit : on le recalcule sur ses
// jours pour ne justifier qu'un écart qui existe, et la justification
// est datée du début de l'écart (elle s'affiche sur sa ligne).
// ============================================================

interface Props {
  params: Promise<{ salleId: string }>;
}

const JOUR_MS = 86_400_000;

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const session = await requireGestionnaire();
    const { salleId } = await params;
    const id = decodeURIComponent(salleId);
    const maintenant = Date.now();
    const j = lireJustification(await req.json().catch(() => ({})), maintenant);
    if ("erreur" in j) {
      return NextResponse.json(
        { error: j.erreur === "texte" ? "La justification est vide" : "Écart invalide", code: j.erreur },
        { status: 400 }
      );
    }

    const d = await chargerSalle(id, {
      periode: "perso",
      du: jourDe(j.debut - JOUR_MS),
      au: jourDe(Math.min(maintenant, j.debut + 14 * JOUR_MS)),
      lignes: false,
      maintenant,
    });
    if (!d) return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
    // Un écart affiché sur une période qui le coupe commence plus tôt : on le reconnaît à son étendue.
    const e = d.stats?.ecarts.find(
      (x) => x.sensorId === j.sensorId && x.grandeur === j.grandeur && x.debut <= j.debut && j.debut <= x.fin
    );
    if (!e) {
      return NextResponse.json(
        { error: "Écart introuvable : la plage ou les mesures ont changé. Recharger la page.", code: "introuvable" },
        { status: 409 }
      );
    }

    await inscrireGeste([
      {
        salleId: id,
        action: "ecart_justifie",
        at: new Date(e.debut).toISOString(),
        par: await auteurDe(session),
        cible: { type: "capteur", id: e.sensorId, nom: e.nom },
        note: j.texte,
        details: { grandeur: e.grandeur, sens: e.sens, debut: e.debut, fin: e.fin, extreme: e.extreme, n: e.n },
      },
    ]);
    return NextResponse.json({ status: "success" });
  } catch (e) {
    return reponseErreur(e);
  }
}
