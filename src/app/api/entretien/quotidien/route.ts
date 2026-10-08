import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { verifierJetonGoogle } from "@/lib/oidc-google";
import { getInterventionsOuvertes } from "@/lib/repo/entretien";
import { estJour } from "@/lib/registre/temps";
import { estFinDeSemaine } from "@/lib/entretien/calendrier";
import { erreurEntretien } from "@/lib/entretien/routes";
import { aujourdHui, contexte, envoyerAvisDuJour, ouvrirFenetres, relireTaches } from "@/lib/entretien/service";

// ============================================================
// POST /api/entretien/quotidien — la tâche du matin de l'entretien.
//
// Appelée chaque jour à 7 h (heure de Montréal) par la tâche Cloud
// Scheduler « entretien-salles-matin », avec un jeton OIDC de compte de
// service ; ou à la main par un administrateur. Dans l'ordre :
//  1. relit les tâches GANDALF des interventions ouvertes (fermée dans
//     GANDALF → « à valider ») ;
//  2. ouvre les fenêtres du jour et crée les tâches (pas la fin de
//     semaine : GANDALF préviendrait les personnes un samedi) ;
//  3. rappels J−7 et J, relance J+1, escalade J+7, résumé du lundi (D2).
// Relancée le même jour, elle ne double rien (une occurrence par règle,
// avis notés par étape et par jour).
// Un administrateur peut passer { jour: "AAAA-MM-JJ" } pour un essai.
// ============================================================

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function comptePermis(email: string): boolean {
  const liste = (process.env.REGISTRE_COPIE_COMPTES || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const e = email.toLowerCase();
  if (liste.length) return liste.includes(e);
  return e === "271227085398-compute@developer.gserviceaccount.com" || e.endsWith("@antigravity-20260107.iam.gserviceaccount.com");
}

function audiences(req: NextRequest): string[] {
  const hote = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const out = [`https://${hote}/api/entretien/quotidien`, `https://${hote}`];
  if (process.env.NEXT_PUBLIC_APP_URL) out.push(`${process.env.NEXT_PUBLIC_APP_URL}/api/entretien/quotidien`);
  out.push("https://gestion-salles-271227085398.us-east1.run.app/api/entretien/quotidien");
  return out;
}

async function appelant(req: NextRequest): Promise<{ email: string; admin: boolean } | null> {
  const bearer = /^Bearer (.+)$/i.exec(req.headers.get("authorization") || "")?.[1];
  if (bearer) {
    const j = await verifierJetonGoogle(bearer, audiences(req), comptePermis);
    if (j) return { email: j.email, admin: false };
  }
  const s = await getSession();
  if (s && (s.role === "admin" || s.role === "superadmin")) return { email: s.email, admin: true };
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const qui = await appelant(req);
    if (!qui) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const jour = qui.admin && estJour(body.jour) ? (body.jour as string) : aujourdHui();
    const debut = Date.now();
    const ctx = await contexte();

    const ouvertes = await getInterventionsOuvertes();
    await relireTaches(ouvertes, ctx);
    const creer = ctx.config.tachesActives && !estFinDeSemaine(jour);
    const fenetres = creer ? await ouvrirFenetres(jour, ctx) : { ouvertes: 0, taches: 0, sansPersonne: 0, erreurs: [] as string[] };
    const avis = ctx.config.avisActifs ? await envoyerAvisDuJour(jour, ctx) : null;

    console.log(
      `[entretien] matin ${jour} (${qui.email}) : ${fenetres.ouvertes} ouvertes, ${fenetres.taches} tâches, ${fenetres.erreurs.length} erreurs, avis ${JSON.stringify(avis)}, ${Date.now() - debut} ms`
    );
    return NextResponse.json({ status: fenetres.erreurs.length ? "partiel" : "success", jour, par: qui.email, fenetres, avis, dureeMs: Date.now() - debut });
  } catch (e) {
    return erreurEntretien(e);
  }
}
