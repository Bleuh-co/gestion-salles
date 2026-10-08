import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getLocal } from "@/lib/repo/locaux";
import { deposer } from "@/lib/entretien/fichiers";
import { acteurDe, erreurEntretien, estGestionnaire } from "@/lib/entretien/routes";
import { lireSignalement } from "@/lib/entretien/saisie";
import { signalerProbleme } from "@/lib/entretien/service";
import { getConfigEntretien } from "@/lib/repo/entretien";
import type { Fichier } from "@/lib/entretien/types";
import { vueFile } from "@/lib/entretien/vues";

// ============================================================
// GET  /api/entretien/interventions — la file (V8). Un gestionnaire voit
//   tout ; les autres, ce qui leur est assigné et ce qu'ils ont signalé.
// POST /api/entretien/interventions — « Signaler un problème » (V5),
//   formulaire multipart : salleId, description, priorite (0–5),
//   actifIds, horsService, assigner (gestionnaire), photos (jusqu'à 4).
//   Toute personne qui voit la salle peut signaler.
// ============================================================

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  description: "Décrire le problème en quelques mots",
  priorite: "Priorité de 0 à 5",
};

export async function GET() {
  try {
    const s = await requireSession();
    const { interventions, jour } = await vueFile();
    const moi = s.email.toLowerCase();
    const visibles = estGestionnaire(s)
      ? interventions
      : interventions.filter((iv) => iv.assignes.includes(moi) || iv.signalePar?.email === moi);
    return NextResponse.json({ interventions: visibles, jour, gestionnaire: estGestionnaire(s), moi });
  } catch (e) {
    return erreurEntretien(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireSession();
    // Sans équipe ni responsable, un problème signalé ne préviendrait personne : le signalement attend D4.
    const cfg = await getConfigEntretien();
    if (!cfg.equipe.length && !cfg.responsable) {
      return NextResponse.json({ error: "L'équipe d'entretien n'est pas encore choisie : prévenir directement le responsable de la salle." }, { status: 409 });
    }
    const form = await req.formData();
    const champs = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
    const local = await getLocal(String(champs.salleId || ""));
    if (!local) return NextResponse.json({ error: "Salle introuvable" }, { status: 404 });
    const lu = lireSignalement(champs);
    if ("erreur" in lu) return NextResponse.json({ error: MESSAGES[lu.erreur], code: lu.erreur }, { status: 400 });
    const par = await acteurDe(s);
    const photos: Fichier[] = [];
    for (const f of form.getAll("photos").slice(0, 4)) {
      if (f instanceof File && f.size > 0) photos.push(await deposer(`signalements/${local.id}`, f, par));
    }
    const iv = await signalerProbleme(
      {
        salleId: local.id,
        actifIds: lu.actifIds,
        description: lu.description,
        priorite: lu.priorite,
        photos,
        horsService: lu.horsService && estGestionnaire(s),
        assigner: estGestionnaire(s) ? lu.assigner : [],
      },
      par
    );
    return NextResponse.json({ status: "success", intervention: { id: iv.id, statut: iv.statut } });
  } catch (e) {
    return erreurEntretien(e);
  }
}
