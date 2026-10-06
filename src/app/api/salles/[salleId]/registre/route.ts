import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { chargerSalle, courbesDe } from "@/lib/registre/service";
import { reponseErreur } from "@/lib/registre/routes";

// ============================================================
// GET /api/salles/[salleId]/registre?periode=7j|30j|3m|12m|tout|24h|perso&du&au&vue=registre|mesures
//
// vue=registre (défaut) : lignes du registre + chiffres de la période (V1).
// vue=mesures : courbes, résumé par jour et capteurs (V2, V3, V12).
// Toute personne qui voit la salle peut lire son registre (plan, 2.6).
// ============================================================

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  try {
    const { salleId } = await params;
    const sp = req.nextUrl.searchParams;
    const vue = sp.get("vue") === "mesures" ? "mesures" : "registre";
    const d = await chargerSalle(decodeURIComponent(salleId), {
      periode: sp.get("periode"),
      du: sp.get("du"),
      au: sp.get("au"),
      lignes: vue === "registre",
    });
    if (!d) return NextResponse.json({ error: "Local introuvable" }, { status: 404 });

    const stats = d.stats && {
      recus: d.stats.recus,
      attendus: d.stats.attendus,
      c: d.stats.c,
      h: d.stats.h,
      depuis: d.stats.depuis,
      ecarts: d.stats.ecarts.length,
      ecartsEnCours: d.stats.ecarts.filter((e) => e.enCours).length,
      muets: d.stats.muets.length,
      dureeMuetMin: Math.round(d.stats.muets.reduce((s, m) => s + (m.fin - m.debut), 0) / 60_000),
      plusLongTrouMin: Math.round(d.stats.plusLongTrou / 60_000),
    };

    const commun = {
      salleId: d.salle.id,
      conditions: d.salle.conditions,
      plages: d.plages,
      bornes: d.bornes,
      maintenant: d.maintenant,
      capteurs: d.capteurs,
      aEuCapteur: d.aEuCapteur,
      stats,
      incomplet: d.incomplet,
    };
    if (vue === "mesures") return NextResponse.json({ ...commun, courbes: courbesDe(d) });
    return NextResponse.json({ ...commun, lignes: d.lignes });
  } catch (e) {
    return reponseErreur(e);
  }
}
