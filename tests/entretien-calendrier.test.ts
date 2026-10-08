import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ajouterMois,
  avisDuJour,
  echeancesEntre,
  echeanceSaison,
  estFinDeSemaine,
  fenetreParDefaut,
  joursAvant,
  ouvertureDe,
  suivante,
} from "../src/lib/entretien/calendrier.ts";
import type { Frequence, Intervention } from "../src/lib/entretien/types.ts";

const annuelle: Frequence = { type: "periodique", n: 1, unite: "an" };
const mensuelle: Frequence = { type: "periodique", n: 1, unite: "mois" };

test("mois : le jour est borné à la longueur du mois, et l'ancre est gardée", () => {
  assert.equal(ajouterMois("2026-01-31", 1), "2026-02-28");
  assert.equal(ajouterMois("2028-01-31", 1), "2028-02-29");
  assert.equal(ajouterMois("2026-02-28", 1, 31), "2026-03-31");
  assert.equal(ajouterMois("2026-11-15", 3), "2027-02-15");
  assert.equal(ajouterMois("2026-04-06", 12), "2027-04-06");
});

test("fenêtre par défaut : 30 jours pour une annuelle, 7 pour une mensuelle", () => {
  assert.equal(fenetreParDefaut(annuelle), 30);
  assert.equal(fenetreParDefaut(mensuelle), 7);
  assert.equal(fenetreParDefaut({ type: "periodique", n: 1, unite: "semaine" }), 2);
  assert.equal(fenetreParDefaut({ type: "periodique", n: 3, unite: "mois" }), 14);
  assert.equal(fenetreParDefaut({ type: "periodique", n: 6, unite: "mois" }), 21);
  assert.equal(fenetreParDefaut({ type: "periodique", n: 5, unite: "an" }), 30);
});

test("exemple du plan : le compresseur prévu le 6 avril apparaît le 7 mars", () => {
  assert.equal(ouvertureDe("2026-04-06", { fenetreJours: null, frequence: annuelle }), "2026-03-07");
  assert.equal(ouvertureDe("2026-04-06", { fenetreJours: 10, frequence: annuelle }), "2026-03-27");
});

test("D5 depuis la date prévue : faite en retard, la série garde son calendrier", () => {
  const r = { frequence: annuelle, calcul: "prevue" as const };
  assert.equal(suivante(r, "2026-04-06", "2026-10-20"), "2027-04-06");
  // Faite en avance (fenêtre ouverte) : la suivante est une période plus loin.
  assert.equal(suivante(r, "2026-04-06", "2026-03-20"), "2027-04-06");
  // Mensuelle en retard de plus d'une période : les dates passées sont sautées.
  const m = { frequence: mensuelle, calcul: "prevue" as const };
  assert.equal(suivante(m, "2026-09-02", "2026-12-15"), "2027-01-02");
  // Jour 31 : pas de dérive.
  assert.equal(suivante(m, "2026-01-31", "2026-01-31"), "2026-02-28");
});

test("D5 depuis la date faite : une période après le jour où c'est fait", () => {
  const r = { frequence: mensuelle, calcul: "faite" as const };
  assert.equal(suivante(r, "2026-09-02", "2026-10-08"), "2026-11-08");
});

test("tous les 5 ans, ponctuelle, saisonnière", () => {
  assert.equal(suivante({ frequence: { type: "periodique", n: 5, unite: "an" }, calcul: "prevue" }, "2026-05-30", "2026-11-02"), "2031-05-30");
  assert.equal(suivante({ frequence: { type: "ponctuelle" }, calcul: "prevue" }, "2026-05-30", "2026-05-30"), null);
  const saison: Frequence = { type: "saisonniere", mois: [7, 8] };
  assert.equal(echeanceSaison([7, 8], 2027), "2027-08-31");
  assert.equal(ouvertureDe("2027-08-31", { fenetreJours: null, frequence: saison }), "2027-07-01");
  assert.equal(suivante({ frequence: saison, calcul: "prevue" }, "2026-08-31", "2026-08-12"), "2027-08-31");
  assert.equal(suivante({ frequence: saison, calcul: "prevue" }, "2026-08-31", "2027-01-10"), "2027-08-31");
});

test("calendrier : les échéances d'une règle sur 12 mois", () => {
  const r = { frequence: { type: "periodique", n: 6, unite: "mois" } as Frequence, calcul: "prevue" as const, prochaine: "2026-04-06" };
  assert.deepEqual(echeancesEntre(r, "2026-10-08", "2027-10-07"), ["2027-04-06", "2027-10-06"]);
  assert.deepEqual(echeancesEntre(r, "2026-01-01", "2027-10-07"), ["2026-04-06", "2026-10-06", "2027-04-06", "2027-10-06"]);
  assert.deepEqual(echeancesEntre({ ...r, prochaine: null }, "2026-01-01", "2027-01-01"), []);
});

test("fin de semaine et jours avant l'échéance", () => {
  assert.equal(estFinDeSemaine("2026-10-10"), true); // samedi
  assert.equal(estFinDeSemaine("2026-10-11"), true); // dimanche
  assert.equal(estFinDeSemaine("2026-10-12"), false);
  assert.equal(joursAvant("2026-04-06", "2026-10-07"), -184);
  assert.equal(joursAvant("2026-10-14", "2026-10-07"), 7);
});

function iv(p: Partial<Intervention>): Intervention {
  return {
    statut: "a_faire",
    echeance: "2026-10-14",
    avis: {},
    dernierAvis: null,
    priorite: null,
    tacheId: "t1",
    ...p,
  } as Intervention;
}

test("D2 : J−7, jour J, relance J+1, escalade J+7, un seul avis à la fois", () => {
  const x = iv({});
  assert.equal(avisDuJour(x, "2026-10-06"), null); // J−8 : rien
  assert.equal(avisDuJour(x, "2026-10-07"), "j7");
  assert.equal(avisDuJour({ ...x, avis: { j7: "2026-10-07" } }, "2026-10-08"), null);
  assert.equal(avisDuJour({ ...x, avis: { j7: "2026-10-07" } }, "2026-10-14"), "j0");
  assert.equal(avisDuJour({ ...x, avis: { j7: "x", j0: "x" } }, "2026-10-15"), "j1");
  assert.equal(avisDuJour({ ...x, avis: { j7: "x", j0: "x", j1: "x" } }, "2026-10-16"), null);
  assert.equal(avisDuJour({ ...x, avis: { j7: "x", j0: "x", j1: "x" } }, "2026-10-21"), "escalade");
  assert.equal(avisDuJour({ ...x, avis: { j7: "x", j0: "x", j1: "x", escalade: "x" } }, "2026-10-28"), null);
});

test("D2 : au plus un avis par jour, rien la fin de semaine sauf priorité 0 ou 1", () => {
  const x = iv({ dernierAvis: "2026-10-07" });
  assert.equal(avisDuJour(x, "2026-10-07"), null); // la tâche vient d'être créée : GANDALF a déjà prévenu
  assert.equal(avisDuJour(iv({ echeance: "2026-10-10" }), "2026-10-10"), null); // samedi
  assert.equal(avisDuJour(iv({ echeance: "2026-10-10", priorite: 1 }), "2026-10-10"), "j0");
  assert.equal(avisDuJour(iv({ statut: "a_valider" }), "2026-10-14"), null);
  assert.equal(avisDuJour(iv({ tacheId: null }), "2026-10-14"), null);
});

test("D2 : une tâche créée déjà en retard remonte au responsable", () => {
  const x = iv({ echeance: "2026-04-06", dernierAvis: "2026-10-07" });
  assert.equal(avisDuJour(x, "2026-10-07"), null);
  assert.equal(avisDuJour(x, "2026-10-08"), "escalade");
  assert.equal(avisDuJour({ ...x, avis: { escalade: "2026-10-08" }, dernierAvis: "2026-10-08" }, "2026-10-09"), null);
});
