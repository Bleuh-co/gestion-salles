import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { saveLocalOverride, loadLocauxOverrides } from "@/lib/locaux-overrides";
import { getLocal } from "@/lib/data";

/**
 * GET /api/admin/locaux-overrides
 * List all Firestore overrides for locaux (admin only).
 */
export async function GET() {
  try {
    await requireAdmin();
    const overrides = await loadLocauxOverrides();
    const list = Array.from(overrides.entries()).map(([localId, fields]) => ({
      local_id: localId,
      ...fields,
    }));
    return NextResponse.json({ overrides: list, count: list.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Allowed fields that can be overridden
const ALLOWED_FIELDS = new Set(["nomSalle", "statut", "conditions", "niveauAcces", "vocation", "prod"]);

/**
 * POST /api/admin/locaux-overrides
 * Save an override: { local_id, field, value }
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
    const local = getLocal(local_id);
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

    await saveLocalOverride(local_id, { [field]: value }, session.email);

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
