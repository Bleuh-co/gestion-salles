import { NextResponse } from "next/server";
import { verifySso, GandalfDenied } from "@bleuh-co/gandalf-sdk-next/server";
import { gandalfAdmin } from "@/lib/gandalf";
import { SESSION_COOKIE, resolveRoleVerbose } from "@/lib/auth-server";
import { isEmailDomainAllowed } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Endpoint de diagnostic : montre EXACTEMENT comment l'app résout le
 * rôle de l'utilisateur connecté. Utile pour déboguer les soucis de
 * propagation des accès depuis le gestionnaire Gandalf.
 *
 * Accepte les mêmes credentials que le reste de l'app (SDK Gandalf) :
 * Bearer OU cookie __session de l'app OU cookie hub __gandalf_session.
 * failOpen local : on renvoie la résolution verbose même pour un rôle
 * refusé (c'est le but du diagnostic) — l'identité, elle, est vérifiée.
 */
export async function GET() {
  let email: string | null = null;
  try {
    const s = await verifySso(gandalfAdmin, {
      cookieName: SESSION_COOKIE,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      // Pas de résolution de rôle ici : seul le credential est vérifié, pour
      // pouvoir diagnostiquer aussi les utilisateurs sans accès.
      roleMapper: async () => "diagnostic",
    });
    email = s.user.email;
  } catch (e) {
    if (e instanceof GandalfDenied) {
      return NextResponse.json({ error: "Non authentifié" }, { status: e.status });
    }
    return NextResponse.json({ error: "Session invalide" }, { status: 401 });
  }
  if (!email || !isEmailDomainAllowed(email)) {
    return NextResponse.json({ error: "Domaine non autorisé" }, { status: 403 });
  }

  const resolution = await resolveRoleVerbose(email);
  return NextResponse.json(resolution);
}
