import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getServerLang } from "@/lib/i18n-server";
import { inscrire } from "@/lib/repo/registre";
import { chargerExport, construireClasseur, estimer, lireDemande, nomFichier } from "@/lib/registre/export";
import { auteurDe, reponseErreur } from "@/lib/registre/routes";

// ============================================================
// GET /api/registre/export?salles=A|B&periode|du&au&journal&parJour&mesures&actifs&capteurs&lang
//   &estimer=1 → nombre de lignes de chaque contenu (fenêtre Exporter, V6)
//   sinon      → fichier Excel (V7). Chaque export s'inscrit au registre
//                de chaque salle exportée (qui, quand, quelle période).
// Toute personne qui voit la salle peut exporter son registre (plan, 2.6) ;
// plusieurs salles d'un coup : 10 au plus, sans limite pratique pour un
// administrateur (Administration › Registre).
// ============================================================

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  try {
    const demande = lireDemande(req.nextUrl.searchParams, await getServerLang());
    if (!demande.salles.length) return NextResponse.json({ error: "Aucune salle" }, { status: 400 });
    const admin = session.role === "admin" || session.role === "superadmin";
    if (!admin && demande.salles.length > 10) {
      return NextResponse.json({ error: "10 salles au plus (plusieurs salles : Administration › Registre)" }, { status: 403 });
    }
    const x = await chargerExport(demande);
    if (!x.salles.length) return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
    if (req.nextUrl.searchParams.get("estimer") === "1") {
      return NextResponse.json({ ...estimer(x), bornes: x.salles[0].bornes });
    }

    const par = await auteurDe(session);
    const fichier = await construireClasseur(x, par.nom || par.email);
    const b = x.salles[0].bornes;
    await inscrire(
      x.salles.map((d) => ({
        salleId: d.salle.id,
        action: "registre_exporte" as const,
        par,
        details: { du: b.duJour, au: b.auJour, format: "xlsx", salles: x.salles.length, lang: demande.lang },
      }))
    );
    const nom = nomFichier(x, "xlsx");
    const ascii = nom.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
    return new NextResponse(new Uint8Array(fichier), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return reponseErreur(e);
  }
}
