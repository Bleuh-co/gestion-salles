import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSession } from "@/lib/auth-server";
import { getConfigEntretien, saveConfigEntretien } from "@/lib/repo/entretien";
import { nomsPersonnes } from "@/lib/repo/personnes";
import { avisConfigures } from "@/lib/entretien/avis";
import { tachesConfigurees } from "@/lib/entretien/gandalf";
import { erreurEntretien } from "@/lib/entretien/routes";
import type { ConfigEntretien } from "@/lib/entretien/types";

// ============================================================
// GET /api/entretien/config — réglages de l'entretien (toute personne connectée :
//   l'écran sait s'il peut proposer « Signaler un problème »).
// PUT /api/entretien/config (administrateurs) — responsable, équipe, personne
//   par défaut de chaque corps de métier, projet et listes GANDALF, listes
//   de choix, interrupteurs des tâches et des avis.
// ============================================================

export const dynamic = "force-dynamic";

const courriel = (v: unknown) => {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) ? e : "";
};
const id = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_-]{0,40}$/.test(v.trim()) ? v.trim() : null);

export async function GET() {
  try {
    await requireSession();
    const cfg = await getConfigEntretien();
    const noms = await nomsPersonnes([cfg.responsable, ...cfg.equipe, ...Object.values(cfg.metiers)]);
    return NextResponse.json({
      config: cfg,
      noms: Object.fromEntries(noms),
      branchements: { taches: tachesConfigurees(), avis: avisConfigures() },
    });
  } catch (e) {
    return erreurEntretien(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const s = await requireAdmin();
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: Partial<ConfigEntretien> = {};
    if ("responsable" in b) patch.responsable = courriel(b.responsable);
    if (Array.isArray(b.equipe)) patch.equipe = [...new Set(b.equipe.map(courriel).filter(Boolean))].slice(0, 30);
    if (b.metiers && typeof b.metiers === "object") {
      patch.metiers = Object.fromEntries(
        Object.entries(b.metiers as Record<string, unknown>)
          .map(([k, v]) => [String(k).slice(0, 80), courriel(v)] as const)
          .filter(([k, v]) => k && v)
      );
    }
    for (const k of ["projetGandalf", "listePreventifs", "listeProblemes"] as const) {
      if (k in b) {
        const v = id(b[k]);
        if (v === null) return NextResponse.json({ error: `${k} invalide` }, { status: 400 });
        patch[k] = v;
      }
    }
    if (typeof b.tachesActives === "boolean") patch.tachesActives = b.tachesActives;
    if (typeof b.avisActifs === "boolean") patch.avisActifs = b.avisActifs;
    if (b.listes && typeof b.listes === "object") {
      const l = b.listes as Record<string, unknown>;
      const lire = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))].slice(0, 40) : undefined);
      const cur = (await getConfigEntretien()).listes;
      patch.listes = {
        types: lire(l.types) ?? cur.types,
        priorites: cur.priorites,
        metiers: lire(l.metiers) ?? cur.metiers,
        criticites: lire(l.criticites) ?? cur.criticites,
        departements: lire(l.departements) ?? cur.departements,
      };
    }
    const config = await saveConfigEntretien(patch, s.email);
    return NextResponse.json({ status: "success", config });
  } catch (e) {
    return erreurEntretien(e);
  }
}
