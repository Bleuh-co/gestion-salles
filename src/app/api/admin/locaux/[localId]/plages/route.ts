import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { getLocal, updateLocalPlages, LOCAL_PLAGE_FIELDS, type LocalPlageField } from "@/lib/repo/locaux";
import { computeChanges, logAudit } from "@/lib/repo/audit";
import { assurerOuverture, inscrireFiche } from "@/lib/repo/registre";
import { auteurDe, reponseErreur } from "@/lib/registre/routes";

// ============================================================
// PUT /api/admin/locaux/[localId]/plages (admin+) — V5
//   { plageTempMin, plageTempMax, plageHumMin, plageHumMax, plageSeuil }
//   nombre ou null (null = non suivie). Le changement s'inscrit au
//   registre (avant → après) ; les écarts se recalculent sur le passé.
// ============================================================

interface Props {
  params: Promise<{ localId: string }>;
}

const BORNES: Record<LocalPlageField, [number, number]> = {
  plageTempMin: [-80, 80],
  plageTempMax: [-80, 80],
  plageHumMin: [0, 100],
  plageHumMax: [0, 100],
  plageSeuil: [1, 48],
};

export async function PUT(req: NextRequest, { params }: Props) {
  try {
    const session = await requireAdmin();
    const { localId } = await params;
    const id = decodeURIComponent(localId);
    const local = await getLocal(id);
    if (!local) return NextResponse.json({ error: "Local introuvable" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const valeurs: Partial<Record<LocalPlageField, number | null>> = {};
    for (const k of LOCAL_PLAGE_FIELDS) {
      if (!(k in body)) continue;
      const v = body[k];
      if (v === null || v === "") {
        valeurs[k] = null;
        continue;
      }
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      const [min, max] = BORNES[k];
      if (!Number.isFinite(n) || n < min || n > max) {
        return NextResponse.json({ error: `Valeur invalide pour ${k} (${min} à ${max})` }, { status: 400 });
      }
      valeurs[k] = k === "plageSeuil" ? Math.round(n) : Math.round(n * 10) / 10;
    }
    const fusion = { ...local, ...valeurs };
    for (const [a, b] of [["plageTempMin", "plageTempMax"], ["plageHumMin", "plageHumMax"]] as const) {
      const lo = fusion[a];
      const hi = fusion[b];
      if (lo != null && hi != null && lo > hi) {
        return NextResponse.json({ error: "Le minimum dépasse le maximum" }, { status: 400 });
      }
    }

    await assurerOuverture();
    await updateLocalPlages(id, valeurs, session.email);
    const changes = computeChanges(local as unknown as Record<string, unknown>, valeurs);
    if (Object.keys(changes).length) {
      await inscrireFiche(local, "plage_modifiee", await auteurDe(session), changes);
      await logAudit({
        action: "update",
        target: "local",
        targetId: id,
        targetName: local.nomSalle || id,
        changes,
        user: session.email,
      });
    }
    return NextResponse.json({ status: "success", ...valeurs });
  } catch (e) {
    return reponseErreur(e);
  }
}
