import { NextRequest, NextResponse } from "next/server";
import { requireGestionnaire } from "@/lib/auth-server";
import { getInterventionsOuvertes, getRegle, modifierRegle } from "@/lib/repo/entretien";
import { changementsRegle, lireRegle, MESSAGES_REGLE } from "@/lib/entretien/saisie";
import { acteurDe, erreurEntretien } from "@/lib/entretien/routes";
import { annuler, contexte, inscrireRegle } from "@/lib/entretien/service";

// ============================================================
// PATCH  /api/entretien/regles/[regleId] (gestionnaire+) — modifier.
// DELETE /api/entretien/regles/[regleId] (gestionnaire+) — retirer :
//   la règle est archivée (rien ne s'efface) et son occurrence ouverte
//   est annulée, avec une ligne au registre.
// ============================================================

interface Props {
  params: Promise<{ regleId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Props) {
  try {
    const s = await requireGestionnaire();
    const { regleId } = await params;
    const avant = await getRegle(regleId);
    if (!avant || avant.etat === "archivee") return NextResponse.json({ error: "Entretien introuvable" }, { status: 404 });
    const lu = lireRegle(await req.json().catch(() => null));
    if ("erreur" in lu) return NextResponse.json({ error: MESSAGES_REGLE[lu.erreur], code: lu.erreur }, { status: 400 });
    const par = await acteurDe(s);
    const etat = lu.complete ? "active" : "a_completer";
    await modifierRegle(regleId, { ...lu.regle, etat }, par.email);
    const apres = (await getRegle(regleId))!;
    const changes = changementsRegle(avant, lu.regle);
    if (Object.keys(changes).length) await inscrireRegle(apres, "entretien_modifie", par, await contexte(), changes);
    return NextResponse.json({ status: "success", regle: apres });
  } catch (e) {
    return erreurEntretien(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Props) {
  try {
    const s = await requireGestionnaire();
    const { regleId } = await params;
    const r = await getRegle(regleId);
    if (!r || r.etat === "archivee") return NextResponse.json({ error: "Entretien introuvable" }, { status: 404 });
    const motif = String((await req.json().catch(() => ({})))?.motif || "").trim().slice(0, 300) || "Entretien retiré";
    const par = await acteurDe(s);
    await modifierRegle(regleId, { etat: "archivee" }, par.email);
    for (const iv of await getInterventionsOuvertes()) {
      if (iv.regleId === regleId && iv.statut !== "a_valider") await annuler(iv.id, motif, par).catch(() => null);
    }
    await inscrireRegle({ ...r, etat: "archivee" }, "entretien_retire", par, await contexte());
    return NextResponse.json({ status: "success" });
  } catch (e) {
    return erreurEntretien(e);
  }
}
