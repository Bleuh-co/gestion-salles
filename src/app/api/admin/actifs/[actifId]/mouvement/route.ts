import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getActif, updateActif } from "@/lib/repo/actifs";
import { getLocal, getLocaux } from "@/lib/repo/locaux";
import { computeChanges, logAudit } from "@/lib/repo/audit";
import { assurerOuverture, inscrireActif } from "@/lib/repo/registre";
import { auteurDe, momentDuJour, reponseErreur, texteCourt } from "@/lib/registre/routes";
import type { Actif } from "@/lib/types";

// ============================================================
// POST /api/admin/actifs/[actifId]/mouvement (admin+) — V4
//   { action: "deplacer", vers, jour?, motif?, note? }  → vers une autre salle
//   { action: "placer",   vers, jour?, motif?, note? }  → dans une salle (actif sans salle)
//   { action: "retirer",  jour?, motif?, note? }        → hors de toute salle
// Le geste s'inscrit au registre de chaque salle touchée (départ et
// arrivée), avec la date du fait, le motif et la personne.
// ============================================================

interface Props {
  params: Promise<{ actifId: string }>;
}

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const session = await requireAdmin();
    const { actifId } = await params;
    const id = decodeURIComponent(actifId);
    const actif = await getActif(id);
    if (!actif) return NextResponse.json({ error: "Actif introuvable" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (action !== "deplacer" && action !== "placer" && action !== "retirer") {
      return NextResponse.json({ error: "action attendue : deplacer, placer ou retirer" }, { status: 400 });
    }
    const quand = momentDuJour(body.jour);
    if (!quand) return NextResponse.json({ error: "Date invalide (AAAA-MM-JJ, pas dans le futur)" }, { status: 400 });

    let vers = "";
    if (action !== "retirer") {
      vers = typeof body.vers === "string" ? body.vers.trim() : "";
      const salle = vers ? await getLocal(vers) : undefined;
      if (!salle) return NextResponse.json({ error: `Salle « ${vers} » introuvable` }, { status: 400 });
      if (vers === actif.idSalle) return NextResponse.json({ error: "L'actif est déjà dans cette salle" }, { status: 400 });
    } else if (!actif.idSalle) {
      return NextResponse.json({ error: "L'actif n'est dans aucune salle" }, { status: 400 });
    }

    // L'état de départ du registre doit être pris AVANT le premier mouvement.
    await assurerOuverture();
    await updateActif(id, { idSalle: vers }, session.email);
    const apres: Actif = { ...actif, idSalle: vers };
    const changes = computeChanges(actif as unknown as Record<string, unknown>, { idSalle: vers });

    const salles = new Set((await getLocaux({ includeArchived: true })).map((l) => l.id));
    await inscrireActif(actif, apres, await auteurDe(session), salles, changes, {
      at: quand.at,
      jourSeulement: quand.jourSeulement,
      motif: texteCourt(body.motif, 80),
      note: texteCourt(body.note, 500),
    });
    await logAudit({
      action: "update",
      target: "actif",
      targetId: id,
      targetName: actif.nom || id,
      changes,
      user: session.email,
    });
    return NextResponse.json({ status: "success", idSalle: vers });
  } catch (e) {
    return reponseErreur(e);
  }
}
