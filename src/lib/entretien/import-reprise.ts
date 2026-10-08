import "server-only";

import { creerRegle, getReprise, modifierReprise } from "@/lib/repo/entretien";
import { lireRegle } from "./saisie";
import { changerStatut, commenter, essayer, lireTaches } from "./gandalf";
import { contexte, inscrireRegle, type Acteur } from "./service";
import type { LigneReprise } from "./types";

// ============================================================
// Reprise de la GMAO (lot 0) : à la fin de la séance, « Importer ce
// qui est décidé ».
//  - « garder » : la règle proposée (corrigée en séance) est créée,
//    active si elle est complète, sinon « à compléter » ;
//  - les occurrences déjà copiées dans GANDALF pour ce préventif (D3)
//    sont fermées avec le commentaire « remplacée par la règle »,
//    au nom de la personne qui importe ; celles qui sont faites restent ;
//  - « fusionner » et « de côté » sont notés, sans règle.
// Une ligne importée ne l'est jamais deux fois.
// ============================================================

export interface BilanImport {
  regles: number;
  aCompleter: number;
  tachesRemplacees: number;
  tachesNonRemplacees: string[];
  notees: number;
  erreurs: string[];
}

export async function importerReprise(par: Acteur): Promise<BilanImport> {
  const bilan: BilanImport = { regles: 0, aCompleter: 0, tachesRemplacees: 0, tachesNonRemplacees: [], notees: 0, erreurs: [] };
  const ctx = await contexte();
  const lignes = (await getReprise()).filter((l) => !l.importeA);
  const app = (process.env.NEXT_PUBLIC_APP_URL || "https://gestion-salles.chanv.com").replace(/\/+$/, "");
  for (const l of lignes) {
    try {
      if (l.decision === "fusionner" || l.decision === "de_cote") {
        await modifierReprise(l.id, { importeA: new Date().toISOString() });
        bilan.notees++;
        continue;
      }
      if (l.decision !== "garder" || !l.regle) continue;
      const lu = lireRegle(l.regle);
      if ("erreur" in lu) {
        bilan.erreurs.push(`${l.titre} : ${lu.erreur}`);
        continue;
      }
      const regle = await creerRegle(
        {
          ...lu.regle,
          etat: lu.complete ? "active" : "a_completer",
          origine: { source: origineDe(l), refs: refsDe(l) },
          remarque: [lu.regle.remarque, l.noteDecision].filter(Boolean).join(" — "),
        },
        par.email
      );
      await inscrireRegle(regle, "entretien_ajoute", par, ctx);
      if (lu.complete) bilan.regles++;
      else bilan.aCompleter++;

      // D3 : les occurrences copiées d'avance dans GANDALF sont remplacées par la règle.
      const ouvertes = l.tachesARemplacer.map((t) => t.id);
      const etats = await lireTaches(ouvertes);
      for (const t of l.tachesARemplacer) {
        const e = etats.get(t.id);
        if (!e?.existe || e.fermee) continue;
        const erreur = await essayer(async () => {
          await commenter(par, t.id, `Remplacée par la règle d'entretien « ${regle.titre} » de Gestion des Salles, qui crée désormais chaque occurrence à son heure : ${app}/entretien?vue=regles&regle=${regle.id}`);
          await changerStatut(par, t.id, true);
        });
        if (erreur) bilan.tachesNonRemplacees.push(`${t.titre} (${t.echeance ?? "sans date"}) : ${erreur}`);
        else bilan.tachesRemplacees++;
      }
      await modifierReprise(l.id, { importeA: new Date().toISOString(), regleCreee: regle.id });
    } catch (e) {
      bilan.erreurs.push(`${l.titre} : ${e instanceof Error ? e.message : e}`);
    }
  }
  return bilan;
}

function origineDe(l: LigneReprise): "gmao" | "gandalf" {
  return l.source.toUpperCase().includes("GANDALF") && !l.source.toUpperCase().includes("GMAO") ? "gandalf" : "gmao";
}

function refsDe(l: LigneReprise): string[] {
  return l.regle?.origine?.refs ?? [];
}
