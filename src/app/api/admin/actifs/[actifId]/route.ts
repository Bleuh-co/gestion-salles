import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import {
  getActif,
  updateActif,
  deleteActif,
  ACTIF_EDITABLE_FIELDS,
} from "@/lib/repo/actifs";
import { getLocal } from "@/lib/repo/locaux";
import { logAudit, computeChanges } from "@/lib/repo/audit";
import type { Actif } from "@/lib/types";

// ============================================================
// PATCH  /api/admin/actifs/[actifId] — édition { fields } (admin+)
// DELETE /api/admin/actifs/[actifId] — suppression (admin+)
// ============================================================

interface Props {
  params: Promise<{ actifId: string }>;
}

const ALLOWED = new Set<string>(ACTIF_EDITABLE_FIELDS);

export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const session = await requireAdmin();
    const { actifId } = await params;
    const id = decodeURIComponent(actifId);

    const actif = await getActif(id);
    if (!actif) {
      return NextResponse.json({ error: "Actif introuvable" }, { status: 404 });
    }

    const body = await req.json();
    const fields = body.fields;
    if (!fields || typeof fields !== "object") {
      return NextResponse.json({ error: "Body attendu: { fields: {...} }" }, { status: 400 });
    }

    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!ALLOWED.has(k)) {
        return NextResponse.json(
          { error: `Champ « ${k} » non éditable` },
          { status: 400 }
        );
      }
      if (typeof v !== "string" || v.length > 500) {
        return NextResponse.json(
          { error: `Valeur invalide pour « ${k} » (texte, max 500)` },
          { status: 400 }
        );
      }
      clean[k] = v.trim();
    }
    if (Object.keys(clean).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    // Valider la salle si modifiée (vide = désassigner, toujours permis)
    if (clean.idSalle) {
      const salle = await getLocal(clean.idSalle);
      if (!salle) {
        return NextResponse.json(
          { error: `Salle « ${clean.idSalle} » introuvable` },
          { status: 400 }
        );
      }
    }

    await updateActif(id, clean as Partial<Actif>, session.email);

    const changes = computeChanges(actif as unknown as Record<string, unknown>, clean);
    if (Object.keys(changes).length > 0) {
      await logAudit({
        action: "update",
        target: "actif",
        targetId: id,
        targetName: actif.nom || id,
        changes,
        user: session.email,
      });
    }

    return NextResponse.json({ status: "success", updated: Object.keys(clean) });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const session = await requireAdmin();
    const { actifId } = await params;
    const id = decodeURIComponent(actifId);

    const actif = await getActif(id);
    if (!actif) {
      return NextResponse.json({ error: "Actif introuvable" }, { status: 404 });
    }

    await deleteActif(id);
    await logAudit({
      action: "delete",
      target: "actif",
      targetId: id,
      targetName: actif.nom || id,
      user: session.email,
    });

    return NextResponse.json({ status: "success", deleted: id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
