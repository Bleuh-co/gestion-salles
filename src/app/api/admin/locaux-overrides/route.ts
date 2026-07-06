import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getLocal, updateLocal, LOCAL_EDITABLE_FIELDS } from "@/lib/repo/locaux";
import { logAudit, computeChanges } from "@/lib/repo/audit";

// ============================================================
// Compat : ancienne API "overrides" — écrit désormais
// directement dans la collection Firestore "locaux" (source de
// vérité depuis la migration). Conservée pour l'édition inline
// de l'admin ({ local_id, field, value }).
// ============================================================

const ALLOWED_FIELDS = new Set<string>(LOCAL_EDITABLE_FIELDS);

/**
 * POST /api/admin/locaux-overrides
 * Save a single-field edit: { local_id, field, value }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();
    const { local_id, field, value } = body;

    // Validate local_id
    if (!local_id || typeof local_id !== "string") {
      return NextResponse.json({ error: "local_id (string) requis" }, { status: 400 });
    }
    if (local_id.length > 200) {
      return NextResponse.json({ error: "local_id trop long" }, { status: 400 });
    }

    // Validate the room exists
    const local = await getLocal(local_id);
    if (!local) {
      return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
    }

    // Validate field
    if (!field || typeof field !== "string" || !ALLOWED_FIELDS.has(field)) {
      return NextResponse.json(
        { error: `Champ invalide. Autorisés: ${Array.from(ALLOWED_FIELDS).join(", ")}` },
        { status: 400 }
      );
    }

    // Validate value (basic type/length check)
    if (typeof value === "string" && value.length > 500) {
      return NextResponse.json({ error: "Valeur trop longue (max 500)" }, { status: 400 });
    }

    await updateLocal(local_id, { [field]: value }, session.email);

    const changes = computeChanges(
      local as unknown as Record<string, unknown>,
      { [field]: value }
    );
    if (Object.keys(changes).length > 0) {
      await logAudit({
        action: "update",
        target: "local",
        targetId: local_id,
        targetName: local.nomSalle || local.id,
        changes,
        user: session.email,
      });
    }

    return NextResponse.json({
      status: "success",
      local_id,
      field,
      value,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
