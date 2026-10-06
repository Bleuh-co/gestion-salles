import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { verifierJetonGoogle } from "@/lib/oidc-google";
import { copierTout } from "@/lib/repo/releves";
import { etatCapteurs } from "@/lib/registre/service";
import { estJour } from "@/lib/registre/temps";
import { reponseErreur } from "@/lib/registre/routes";

// ============================================================
// POST /api/registre/copie — copie de nuit des relevés (lot 2).
//
// Appelée chaque nuit vers 2 h (heure de Montréal) par une tâche
// Cloud Scheduler du projet de production, avec un jeton OIDC de
// compte de service ; ou à la main par un administrateur
// (Administration › Capteurs). Corps facultatif :
//   { depuis: "AAAA-MM-JJ" }  → rattrapage à partir de ce jour
//   { sensorIds: [...] }      → seulement ces capteurs
// Sans « depuis », chaque capteur reprend après sa dernière copie
// complète (ou depuis sa création : le premier passage rattrape tout).
// Relancée, elle ne double rien.
// ============================================================

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Comptes de service permis : variable REGISTRE_COPIE_COMPTES (liste), sinon ceux du projet de production. */
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
  const out = [`https://${hote}/api/registre/copie`, `https://${hote}`];
  if (process.env.REGISTRE_COPIE_AUDIENCE) out.push(process.env.REGISTRE_COPIE_AUDIENCE);
  if (process.env.NEXT_PUBLIC_APP_URL) out.push(`${process.env.NEXT_PUBLIC_APP_URL}/api/registre/copie`);
  return out;
}

async function appelant(req: NextRequest): Promise<string | null> {
  const bearer = /^Bearer (.+)$/i.exec(req.headers.get("authorization") || "")?.[1];
  if (bearer) {
    const j = await verifierJetonGoogle(bearer, audiences(req), comptePermis);
    if (j) return j.email;
  }
  const s = await getSession();
  if (s && (s.role === "admin" || s.role === "superadmin")) return s.email;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const qui = await appelant(req);
    if (!qui) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const depuis = estJour(body.depuis) ? body.depuis : undefined;
    const sensorIds = Array.isArray(body.sensorIds) ? body.sensorIds.map(String).slice(0, 100) : undefined;

    const debut = Date.now();
    // Rattachements datés à jour d'abord (nouveau capteur, salle changée).
    await etatCapteurs();
    const bilans = await copierTout({ depuis, sensorIds });
    const erreurs = bilans.filter((b) => b.erreur);
    console.log(
      `[copie] ${qui} : ${bilans.length} capteurs, ${bilans.reduce((s, b) => s + b.jours, 0)} jours écrits, ${erreurs.length} erreurs, ${Date.now() - debut} ms`
    );
    return NextResponse.json(
      { status: erreurs.length ? "partiel" : "success", par: qui, dureeMs: Date.now() - debut, bilans },
      { status: erreurs.length && erreurs.length === bilans.length ? 502 : 200 }
    );
  } catch (e) {
    return reponseErreur(e);
  }
}
