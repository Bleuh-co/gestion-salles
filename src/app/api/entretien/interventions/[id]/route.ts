import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getIntervention, getRegle } from "@/lib/repo/entretien";
import { acteurDe, erreurEntretien, estGestionnaire, peutFaire } from "@/lib/entretien/routes";
import {
  annuler,
  assigner,
  changerAvancement,
  cocher,
  contexte,
  refuser,
  relireTaches,
  terminer,
  valider,
} from "@/lib/entretien/service";
import { interventionsVues } from "@/lib/entretien/vues";

// ============================================================
// GET   /api/entretien/interventions/[id] — l'intervention (V6), sa règle,
//       ce que la personne connectée peut y faire.
// PATCH /api/entretien/interventions/[id] — un geste :
//   { action: "assigner", assignes: [courriels] }            gestionnaire
//   { action: "en_cours" | "en_attente", note? }             intervenant ou gestionnaire
//   { action: "cocher", index, fait }                        intervenant ou gestionnaire
//   { action: "terminer", checklist?, mesure?, note? }       intervenant ou gestionnaire
//   { action: "valider", remettreEnService? }                gestionnaire
//   { action: "refuser", motif }                             gestionnaire
//   { action: "annuler", motif }                             gestionnaire
// ============================================================

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Props) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const brute = await getIntervention(id);
    if (!brute) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 });
    const ctx = await contexte();
    const [relue] = await relireTaches([brute], ctx).catch(() => [brute]);
    const [iv] = await interventionsVues([relue], ctx);
    const regle = iv.regleId ? await getRegle(iv.regleId) : null;
    const gestionnaire = estGestionnaire(s);
    return NextResponse.json({
      intervention: iv,
      regle,
      droits: { faire: peutFaire(s, iv), gerer: gestionnaire },
      config: { responsable: !!ctx.config.responsable, priorites: ctx.config.listes.priorites },
    });
  } catch (e) {
    return erreurEntretien(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const iv = await getIntervention(id);
    if (!iv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 });
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const par = await acteurDe(s);
    const gerer = estGestionnaire(s);
    const faire = peutFaire(s, iv);
    const interdit = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const note = typeof b.note === "string" ? b.note : "";
    let apres;
    switch (b.action) {
      case "assigner":
        if (!gerer) return interdit();
        apres = await assigner(id, Array.isArray(b.assignes) ? b.assignes.map(String) : [], par);
        break;
      case "en_cours":
      case "en_attente":
        if (!faire) return interdit();
        apres = await changerAvancement(id, b.action, note, par);
        break;
      case "cocher":
        if (!faire) return interdit();
        apres = await cocher(id, Number(b.index), b.fait === true);
        break;
      case "terminer":
        if (!faire) return interdit();
        apres = await terminer(
          id,
          {
            checklist: Array.isArray(b.checklist) ? b.checklist.map((x) => x === true) : undefined,
            mesure: typeof b.mesure === "string" ? b.mesure : undefined,
            note,
          },
          par
        );
        break;
      case "valider":
        if (!gerer) return interdit();
        apres = await valider(id, par, b.remettreEnService !== false);
        break;
      case "refuser":
        if (!gerer) return interdit();
        apres = await refuser(id, String(b.motif || ""), par);
        break;
      case "annuler":
        if (!gerer) return interdit();
        apres = await annuler(id, String(b.motif || ""), par);
        break;
      default:
        return NextResponse.json({ error: "Geste inconnu" }, { status: 400 });
    }
    return NextResponse.json({ status: "success", statut: apres.statut });
  } catch (e) {
    return erreurEntretien(e);
  }
}
