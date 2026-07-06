import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import {
  getLocal,
  updateLocal,
  setLocalArchived,
  hardDeleteLocal,
  LOCAL_EDITABLE_FIELDS,
} from "@/lib/repo/locaux";
import { logAudit, computeChanges } from "@/lib/repo/audit";
import { LOCAL_STATUT_LABELS } from "@/lib/types";
import type { Local } from "@/lib/types";

// ============================================================
// PATCH  /api/admin/locaux/[localId] — édition / archive / restore (admin+)
//   body: { fields: { nomSalle?, batiment?, ... } }   → mise à jour
//   body: { archive: true | false }                   → archiver / restaurer
// DELETE /api/admin/locaux/[localId] — suppression définitive (superadmin)
// ============================================================

interface Props {
  params: Promise<{ localId: string }>;
}

const ALLOWED = new Set<string>(LOCAL_EDITABLE_FIELDS);

export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const session = await requireAdmin();
    const { localId } = await params;
    const id = decodeURIComponent(localId);

    const local = await getLocal(id);
    if (!local) {
      return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
    }

    const body = await req.json();

    // ── Archive / restore ──
    if (typeof body.archive === "boolean") {
      await setLocalArchived(id, body.archive, session.email);
      await logAudit({
        action: body.archive ? "delete" : "restore",
        target: "local",
        targetId: id,
        targetName: local.nomSalle || id,
        user: session.email,
      });
      return NextResponse.json({ status: "success", archived: body.archive });
    }

    // ── Mise à jour de champs ──
    const fields = body.fields;
    if (!fields || typeof fields !== "object") {
      return NextResponse.json(
        { error: "Body attendu: { fields: {...} } ou { archive: boolean }" },
        { status: 400 }
      );
    }

    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!ALLOWED.has(k)) {
        return NextResponse.json(
          { error: `Champ « ${k} » non éditable. Autorisés: ${[...ALLOWED].join(", ")}` },
          { status: 400 }
        );
      }
      if (k === "prod") {
        clean[k] = Boolean(v);
      } else if (k === "statut") {
        if (typeof v !== "string" || !(v in LOCAL_STATUT_LABELS)) {
          return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
        }
        clean[k] = v;
      } else {
        if (typeof v !== "string" || v.length > 500) {
          return NextResponse.json(
            { error: `Valeur invalide pour « ${k} » (texte, max 500)` },
            { status: 400 }
          );
        }
        clean[k] = v.trim();
      }
    }
    if (Object.keys(clean).length === 0) {
      return NextResponse.json({ error: "Aucun champ à mettre à jour" }, { status: 400 });
    }

    await updateLocal(id, clean as Partial<Local>, session.email);

    const changes = computeChanges(local as unknown as Record<string, unknown>, clean);
    if (Object.keys(changes).length > 0) {
      await logAudit({
        action: "update",
        target: "local",
        targetId: id,
        targetName: local.nomSalle || id,
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
    if (session.role !== "superadmin") {
      return NextResponse.json(
        { error: "Suppression définitive réservée au super administrateur" },
        { status: 403 }
      );
    }
    const { localId } = await params;
    const id = decodeURIComponent(localId);

    const local = await getLocal(id);
    if (!local) {
      return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
    }

    await hardDeleteLocal(id);
    await logAudit({
      action: "delete",
      target: "local",
      targetId: id,
      targetName: `${local.nomSalle || id} (suppression définitive)`,
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
