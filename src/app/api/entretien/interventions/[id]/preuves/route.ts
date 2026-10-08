import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { ajouterFichiers, getIntervention } from "@/lib/repo/entretien";
import { deposer, urlFichier } from "@/lib/entretien/fichiers";
import { acteurDe, erreurEntretien, peutFaire } from "@/lib/entretien/routes";
import type { Fichier } from "@/lib/entretien/types";

// POST /api/entretien/interventions/[id]/preuves — photos, rapport ou facture
// joints à une intervention ouverte (multipart, champ « fichiers », 6 au plus).

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Props) {
  try {
    const s = await requireSession();
    const { id } = await params;
    const iv = await getIntervention(id);
    if (!iv) return NextResponse.json({ error: "Intervention introuvable" }, { status: 404 });
    if (!peutFaire(s, iv)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    if (["validee", "annulee"].includes(iv.statut)) return NextResponse.json({ error: "Intervention fermée" }, { status: 409 });
    const form = await req.formData();
    const par = await acteurDe(s);
    const fichiers: Fichier[] = [];
    for (const f of form.getAll("fichiers").slice(0, 6)) {
      if (f instanceof File && f.size > 0) fichiers.push(await deposer(`interventions/${iv.id}`, f, par));
    }
    if (!fichiers.length) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 });
    await ajouterFichiers(iv.id, "preuves", fichiers);
    return NextResponse.json({ status: "success", fichiers: fichiers.map((f) => ({ ...f, lien: urlFichier(f) })) });
  } catch (e) {
    return erreurEntretien(e);
  }
}
