import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { adminDb } from "@/lib/firebase-admin";
import { cached } from "@/lib/repo/cache";
import { isEmailDomainAllowed } from "@/lib/utils";
import { erreurEntretien } from "@/lib/entretien/routes";

// GET /api/entretien/personnes — l'annuaire du hub (users), pour choisir
// qui fait, le responsable et l'équipe. Nom et adresse seulement.

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireSession();
    const personnes = await cached(
      "entretien:personnes",
      async () => {
        const snap = await adminDb().collection("users").select("name", "disabled", "deleted", "role").get();
        return snap.docs
          .filter((d) => d.id.includes("@") && isEmailDomainAllowed(d.id))
          .filter((d) => !d.data().disabled && !d.data().deleted && d.data().role !== "Non visible")
          .map((d) => ({ email: d.id.toLowerCase(), nom: String(d.data().name || d.id.split("@")[0]) }))
          .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      },
      10 * 60_000
    );
    return NextResponse.json({ personnes });
  } catch (e) {
    return erreurEntretien(e);
  }
}
