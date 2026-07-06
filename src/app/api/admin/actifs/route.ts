import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { createActif, getAllActifs, ACTIF_EDITABLE_FIELDS } from "@/lib/repo/actifs";
import { getLocal } from "@/lib/repo/locaux";
import { logAudit } from "@/lib/repo/audit";
import type { Actif } from "@/lib/types";

// ============================================================
// POST /api/admin/actifs — création d'un actif (admin+).
// L'id est auto-généré (numérique croissant) si non fourni.
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    const nom = typeof body.nom === "string" ? body.nom.trim() : "";
    if (!nom) {
      return NextResponse.json({ error: "Nom de l'actif requis" }, { status: 400 });
    }

    // Valider la salle si fournie
    const idSalle = typeof body.idSalle === "string" ? body.idSalle.trim() : "";
    if (idSalle) {
      const salle = await getLocal(idSalle);
      if (!salle) {
        return NextResponse.json(
          { error: `Salle « ${idSalle} » introuvable` },
          { status: 400 }
        );
      }
    }

    // Champs texte (tous optionnels sauf nom)
    const fields: Record<string, string> = {};
    for (const k of ACTIF_EDITABLE_FIELDS) {
      const v = body[k];
      if (v === undefined || v === null) {
        fields[k] = "";
        continue;
      }
      if (typeof v !== "string" || v.length > 500) {
        return NextResponse.json(
          { error: `Valeur invalide pour « ${k} » (texte, max 500)` },
          { status: 400 }
        );
      }
      fields[k] = v.trim();
    }
    fields.nom = nom;
    fields.idSalle = idSalle;

    // Génération d'id : max numérique + 1 (ou id fourni si unique)
    const all = await getAllActifs();
    let id = typeof body.id === "string" ? body.id.trim() : "";
    if (id) {
      if (id.includes("/")) {
        return NextResponse.json({ error: "L'id ne peut pas contenir « / »" }, { status: 400 });
      }
      if (all.some((a) => a.id === id)) {
        return NextResponse.json({ error: `L'actif « ${id} » existe déjà` }, { status: 409 });
      }
    } else {
      const maxNum = all.reduce((m, a) => {
        const n = parseInt(a.id, 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      id = String(maxNum + 1);
    }

    const actif = { id, ...fields } as unknown as Actif;
    await createActif(actif, session.email);

    await logAudit({
      action: "create",
      target: "actif",
      targetId: id,
      targetName: nom,
      user: session.email,
    });

    return NextResponse.json({ status: "success", actif }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
