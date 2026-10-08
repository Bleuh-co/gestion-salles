import "server-only";

import { getRegles, interventionsDeLaSalle, reglesDeLaSalle } from "@/lib/repo/entretien";
import { nomsPersonnes } from "@/lib/repo/personnes";
import { assignesDe, contexte, nomEquipements } from "./service";
import type { Intervention, Regle } from "./types";

// ============================================================
// L'entretien dans l'export du registre (lot 4) : l'onglet Excel et la
// section PDF « Entretien » — le plan d'entretien des salles exportées
// et les interventions de la période (ouvertes, faites, annulées).
// ============================================================

export interface LigneInterventionExport {
  iv: Intervention;
  salleId: string;
  equipements: string;
  assignes: string;
}

export interface LigneRegleExport {
  regle: Regle;
  salleId: string;
  equipements: string;
  qui: string;
}

export interface EntretienExport {
  regles: LigneRegleExport[];
  interventions: LigneInterventionExport[];
}

/** Une intervention touche la période [du, au) (ms) : créée, faite, validée ou annulée dedans, ou encore ouverte. */
function dansLaPeriode(iv: Intervention, du: number, au: number): boolean {
  const dates = [iv.creeA, iv.termineA, iv.valideA, iv.annuleA].filter((d): d is string => !!d).map((d) => Date.parse(d));
  if (dates.some((t) => t >= du && t < au)) return true;
  return !["validee", "annulee"].includes(iv.statut) && Date.parse(iv.creeA) < au;
}

export async function entretienDesSalles(salleIds: string[], du: number, au: number): Promise<EntretienExport> {
  const ctx = await contexte();
  const regles = await getRegles();
  const out: EntretienExport = { regles: [], interventions: [] };
  const vues = new Set<string>();
  for (const salleId of salleIds) {
    for (const r of reglesDeLaSalle(regles, salleId, ctx.actifs)) {
      out.regles.push({ regle: r, salleId, equipements: nomEquipements(r, ctx), qui: "" });
    }
    for (const iv of await interventionsDeLaSalle(salleId)) {
      if (vues.has(`${salleId}|${iv.id}`) || !dansLaPeriode(iv, du, au)) continue;
      vues.add(`${salleId}|${iv.id}`);
      out.interventions.push({ iv, salleId, equipements: nomEquipements(iv, ctx), assignes: "" });
    }
  }
  const noms = await nomsPersonnes([
    ...out.interventions.flatMap((x) => x.iv.assignes),
    ...out.regles.flatMap((x) => assignesDe(x.regle.qui, ctx.config)),
  ]);
  for (const x of out.interventions) x.assignes = x.iv.assignes.map((e) => noms.get(e) || e).join(", ");
  for (const x of out.regles) {
    const q = x.regle.qui;
    const e = assignesDe(q, ctx.config)[0];
    const personne = e ? noms.get(e) || e : "";
    x.qui = q?.type === "soustraitant" ? [q.fournisseur, personne].filter(Boolean).join(" · ") : q?.type === "metier" ? [q.metier, personne].filter(Boolean).join(" → ") : personne;
  }
  out.interventions.sort((a, b) => (a.iv.termineA || a.iv.creeA).localeCompare(b.iv.termineA || b.iv.creeA));
  return out;
}
