import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { docVersReprise, modifierReprise } from "@/lib/repo/entretien";
import { lireRegle, MESSAGES_REGLE } from "@/lib/entretien/saisie";
import { erreurEntretien } from "@/lib/entretien/routes";
import type { LigneReprise } from "@/lib/entretien/types";

// ============================================================
// PATCH /api/entretien/reprise/[id] (administrateurs) — la décision d'une
// ligne pendant la séance : { decision, noteDecision?, regle? }.
//   garder     → la règle proposée (corrigée ici) sera créée à l'import
//   fusionner  → couverte par une autre ligne
//   de_cote    → mise de côté, avec une raison
//   a_decider  → revenir sur la décision
// ============================================================

const DECISIONS: LigneReprise["decision"][] = ["a_decider", "propose", "garder", "fusionner", "de_cote"];

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const s = await requireAdmin();
    const { id } = await params;
    const ref = adminDb().collection("entretien_reprise").doc(id);
    const d = await ref.get();
    if (!d.exists) return NextResponse.json({ error: "Ligne introuvable" }, { status: 404 });
    const ligne = docVersReprise(d.id, d.data()!);
    if (ligne.importeA) return NextResponse.json({ error: "Ligne déjà importée" }, { status: 409 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Partial<LigneReprise> = { decidePar: s.email, decideA: new Date().toISOString() };
    if (b.decision !== undefined) {
      const dec = DECISIONS.find((x) => x === b.decision);
      if (!dec) return NextResponse.json({ error: "Décision inconnue" }, { status: 400 });
      patch.decision = dec;
    }
    if (typeof b.noteDecision === "string") patch.noteDecision = b.noteDecision.trim().slice(0, 500);
    if (patch.decision === "de_cote" && !(patch.noteDecision ?? ligne.noteDecision)) {
      return NextResponse.json({ error: "Donner la raison de la mise de côté" }, { status: 400 });
    }
    if (b.regle !== undefined) {
      const lu = lireRegle(b.regle);
      if ("erreur" in lu) return NextResponse.json({ error: MESSAGES_REGLE[lu.erreur], code: lu.erreur }, { status: 400 });
      patch.regle = { ...lu.regle, origine: ligne.regle?.origine ?? null };
    }
    if ((patch.decision ?? ligne.decision) === "garder" && !(patch.regle ?? ligne.regle)) {
      return NextResponse.json({ error: "Cette ligne n'a pas de règle à garder : la compléter d'abord" }, { status: 400 });
    }
    await modifierReprise(id, patch);
    return NextResponse.json({ status: "success", ligne: { ...ligne, ...patch } });
  } catch (e) {
    return erreurEntretien(e);
  }
}
