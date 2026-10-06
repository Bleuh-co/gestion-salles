import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getAllActifs, updateActif } from "@/lib/repo/actifs";
import { getLocaux } from "@/lib/repo/locaux";
import { logAudit } from "@/lib/repo/audit";
import { assurerOuverture, inscrireActif } from "@/lib/repo/registre";
import { proposerSalle } from "@/lib/registre/orphelins";
import { auteurDe, reponseErreur } from "@/lib/registre/routes";

// ============================================================
// Équipements orphelins (lot 0) — actifs rattachés à un code de
// salle qui n'existe pas, regroupés par code, avec la salle proposée.
//
// GET  → groupes { code, actifs, salleProposee, certitude } + actifs sans salle
// POST { code, salleId, actifIds? } → rattache les actifs du groupe
//      (tous, ou ceux listés) à la salle choisie, ou à aucune salle
//      (salleId vide). Inscrit une ligne « rattachement corrigé » au
//      registre de la salle choisie.
// ============================================================

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [actifs, locaux] = await Promise.all([getAllActifs(), getLocaux({ includeArchived: true })]);
    const ids = new Set(locaux.map((l) => l.id));
    const groupes = new Map<string, typeof actifs>();
    for (const a of actifs) {
      if (!a.idSalle || ids.has(a.idSalle)) continue;
      const l = groupes.get(a.idSalle);
      if (l) l.push(a);
      else groupes.set(a.idSalle, [a]);
    }
    const refs = locaux.filter((l) => !l.archived).map((l) => ({ id: l.id, nomSalle: l.nomSalle }));
    const resume = (a: (typeof actifs)[number]) => ({ id: a.id, matricule: a.matricule, nom: a.nom, statut: a.statut });
    return NextResponse.json({
      groupes: [...groupes.entries()]
        .map(([code, liste]) => ({ code, actifs: liste.map(resume), ...proposerSalle(code, refs) }))
        .sort((a, b) => b.actifs.length - a.actifs.length || a.code.localeCompare(b.code, "fr")),
      sansSalle: actifs.filter((a) => !a.idSalle).map(resume),
      total: actifs.length,
    });
  } catch (e) {
    return reponseErreur(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const code = typeof body.code === "string" ? body.code : "";
    const salleId = typeof body.salleId === "string" ? body.salleId.trim() : "";
    const locaux = await getLocaux({ includeArchived: true });
    const salles = new Set(locaux.map((l) => l.id));
    if (!code || salles.has(code)) return NextResponse.json({ error: "Code orphelin attendu" }, { status: 400 });
    // salleId vide = « aucune salle » (ex. « BRISÉ NE PAS UTILISER » n'est pas une salle).
    if (salleId && !salles.has(salleId)) return NextResponse.json({ error: `Salle « ${salleId} » introuvable` }, { status: 400 });

    const voulus: string[] | null = Array.isArray(body.actifIds) ? body.actifIds.map(String) : null;
    const cibles = (await getAllActifs()).filter((a) => a.idSalle === code && (!voulus || voulus.includes(a.id)));
    if (!cibles.length) return NextResponse.json({ error: "Aucun actif à rattacher" }, { status: 400 });

    await assurerOuverture();
    const par = await auteurDe(session);
    for (const a of cibles) {
      await updateActif(a.id, { idSalle: salleId }, session.email);
      const changes = { idSalle: { before: code, after: salleId } };
      await inscrireActif(a, { ...a, idSalle: salleId }, par, salles, changes);
      await logAudit({
        action: "update",
        target: "actif",
        targetId: a.id,
        targetName: a.nom || a.id,
        changes,
        user: session.email,
      });
    }
    return NextResponse.json({ status: "success", rattaches: cibles.length });
  } catch (e) {
    return reponseErreur(e);
  }
}
