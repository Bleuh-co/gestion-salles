import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { createLocal, getLocal } from "@/lib/repo/locaux";
import { logAudit } from "@/lib/repo/audit";
import { LOCAL_STATUT_LABELS } from "@/lib/types";
import type { Local, LocalStatut } from "@/lib/types";

// ============================================================
// POST /api/admin/locaux — création d'une salle (admin+).
//
// Le code de salle (id) est IMMUABLE après création : les QR
// imprimés, positions de plan, capteurs et actifs pointent
// dessus. Un renommage = archiver + recréer.
// ============================================================

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function str(v: unknown, max = 500): string | null {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > max ? null : t;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await req.json();

    // ── Code de salle (id) ──
    const id = str(body.id, 100);
    if (!id) return badRequest("Code de salle (id) requis (max 100 caractères)");
    if (id.includes("/")) return badRequest("Le code de salle ne peut pas contenir « / »");

    const existing = await getLocal(id);
    if (existing) {
      return NextResponse.json(
        { error: `Le code de salle « ${id} » existe déjà` },
        { status: 409 }
      );
    }

    // ── Champs ──
    const nomSalle = str(body.nomSalle);
    const batiment = str(body.batiment, 100);
    const etage = str(body.etage, 50);
    const famille = str(body.famille, 100);
    const idLicence = str(body.idLicence, 50);
    const vocation = str(body.vocation);
    const conditions = str(body.conditions);
    const niveauAcces = str(body.niveauAcces, 100);
    const statut = str(body.statut, 50);

    if ([nomSalle, batiment, etage, famille, idLicence, vocation, conditions, niveauAcces, statut].includes(null)) {
      return badRequest("Un des champs texte est invalide (max 500 caractères)");
    }
    if (!batiment) return badRequest("Bâtiment requis");
    if (!etage) return badRequest("Étage requis");
    if (!famille) return badRequest("Famille requise");
    if (!statut || !(statut in LOCAL_STATUT_LABELS)) {
      return badRequest(
        `Statut invalide. Autorisés: ${Object.keys(LOCAL_STATUT_LABELS).join(", ")}`
      );
    }

    const local: Local = {
      id,
      nomSalle: nomSalle!,
      batiment: batiment!,
      etage: etage!,
      famille: famille!,
      idLicence: idLicence!,
      prod: Boolean(body.prod),
      vocation: vocation!,
      conditions: conditions!,
      statut: statut as LocalStatut,
      niveauAcces: niveauAcces!,
      archived: false,
    };

    await createLocal(local, session.email);

    await logAudit({
      action: "create",
      target: "local",
      targetId: id,
      targetName: local.nomSalle || id,
      user: session.email,
    });

    return NextResponse.json({ status: "success", local }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
