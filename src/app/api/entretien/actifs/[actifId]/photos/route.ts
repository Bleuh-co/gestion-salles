import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { getActif } from "@/lib/repo/actifs";
import { ajouterPhotoActif } from "@/lib/repo/entretien";
import { deposer, urlFichier } from "@/lib/entretien/fichiers";
import { acteurDe, erreurEntretien } from "@/lib/entretien/routes";

// POST /api/entretien/actifs/[actifId]/photos (gestionnaire+) — « + Photo » sur la page d'un équipement.

interface Props {
  params: Promise<{ actifId: string }>;
}

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const s = await requireGestionnaire();
    const { actifId } = await params;
    const actif = await getActif(decodeURIComponent(actifId));
    if (!actif) return NextResponse.json({ error: "Équipement introuvable" }, { status: 404 });
    const form = await req.formData();
    const f = form.get("fichier");
    if (!(f instanceof File)) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    const photo = await deposer(`actifs/${actif.id}`, f, await acteurDe(s));
    const legende = String(form.get("legende") || "").trim().slice(0, 120);
    const avecLegende = legende ? { ...photo, legende } : photo;
    await ajouterPhotoActif(actif.id, avecLegende);
    return NextResponse.json({ status: "success", photo: { ...avecLegende, lien: urlFichier(photo) } });
  } catch (e) {
    return erreurEntretien(e);
  }
}
