import { test } from "node:test";
import assert from "node:assert/strict";
import { changementsRegle, lireRegle, lireSignalement } from "../src/lib/entretien/saisie.ts";
import { fournisseurDe, lireDateGmao, lireFrequence, lireQui, lireRefs, regleComplete } from "../src/lib/entretien/reprise.ts";
import { cheminDeRetour } from "../src/lib/retour.ts";

const base = {
  titre: "Inspection du drain",
  actifIds: ["f29e3a3d"],
  frequence: { type: "periodique", n: 1, unite: "an" },
  prochaine: "2026-09-07",
  qui: { type: "metier", metier: "Resp. maintenance Chanv" },
};

test("règle : titre et cible obligatoires ; complète avec fréquence, date et personne", () => {
  const r = lireRegle(base);
  assert.ok(!("erreur" in r));
  assert.equal(r.complete, true);
  assert.equal(r.regle.calcul, "prevue");
  assert.equal(r.regle.preuve, "photo");
  assert.deepEqual(lireRegle({ ...base, titre: "  " }), { erreur: "titre" });
  assert.deepEqual(lireRegle({ ...base, actifIds: [] }), { erreur: "cible" });
  const libre = lireRegle({ ...base, actifIds: [], equipementLibre: "Génératrice (455)" });
  assert.ok(!("erreur" in libre) && libre.regle.equipementLibre === "Génératrice (455)");
});

test("règle : sans fréquence, sans date ou sans personne, elle est « à compléter »", () => {
  for (const manque of [{ frequence: null }, { prochaine: "" }, { qui: null }]) {
    const r = lireRegle({ ...base, ...manque });
    assert.ok(!("erreur" in r));
    assert.equal(r.complete, false);
  }
});

test("règle : saisies invalides refusées ou bornées", () => {
  assert.deepEqual(lireRegle({ ...base, prochaine: "07/09/2026" }), { erreur: "prochaine" });
  assert.deepEqual(lireRegle({ ...base, fenetreJours: 400 }), { erreur: "fenetre" });
  assert.deepEqual(lireRegle({ ...base, procedureUrl: "javascript:alert(1)" }), { erreur: "procedure" });
  const r = lireRegle({ ...base, frequence: { type: "periodique", n: 0, unite: "an" }, qui: { type: "personne", email: "pas-une-adresse" } });
  assert.ok(!("erreur" in r));
  assert.equal(r.regle.frequence, null);
  assert.equal(r.regle.qui, null);
  const s = lireRegle({ ...base, frequence: { type: "saisonniere", mois: [9, 7, 13, 7] } });
  assert.ok(!("erreur" in s));
  assert.deepEqual(s.regle.frequence, { type: "saisonniere", mois: [7, 9] });
  const longue = lireRegle({ ...base, checklist: Array.from({ length: 50 }, (_, i) => `étape ${i}`) });
  assert.ok(!("erreur" in longue) && longue.regle.checklist.length === 30);
});

test("changements d'une règle : lisibles au registre", () => {
  const a = lireRegle(base);
  const b = lireRegle({ ...base, frequence: { type: "periodique", n: 6, unite: "mois" }, prochaine: "2026-10-07" });
  assert.ok(!("erreur" in a) && !("erreur" in b));
  const c = changementsRegle(a.regle, b.regle);
  assert.deepEqual(Object.keys(c).sort(), ["regle.frequence", "regle.prochaine"]);
  assert.deepEqual(c["regle.frequence"], { before: "tous les 1 an", after: "tous les 6 mois" });
});

test("signalement : description, priorité 0 à 5, équipement et personnes", () => {
  assert.deepEqual(lireSignalement({ description: "x" }), { erreur: "description" });
  assert.deepEqual(lireSignalement({ description: "Eau au sol", priorite: "7" }), { erreur: "priorite" });
  const s = lireSignalement({ description: " Eau au sol ", priorite: "2", actifIds: "f29e3a3d", horsService: "1", assigner: "P.Leclair@chanv.com,nimporte" });
  assert.deepEqual(s, { description: "Eau au sol", priorite: 2, actifIds: ["f29e3a3d"], horsService: true, assigner: ["p.leclair@chanv.com"] });
});

test("reprise GMAO : fréquences, dates, références, corps de métier", () => {
  assert.deepEqual(lireFrequence("Annuel"), { type: "periodique", n: 1, unite: "an" });
  assert.deepEqual(lireFrequence("Semestriel"), { type: "periodique", n: 6, unite: "mois" });
  assert.deepEqual(lireFrequence("Trimestriel"), { type: "periodique", n: 3, unite: "mois" });
  assert.deepEqual(lireFrequence("Mensuel"), { type: "periodique", n: 1, unite: "mois" });
  assert.deepEqual(lireFrequence("Aux 5 ans"), { type: "periodique", n: 5, unite: "an" });
  assert.deepEqual(lireFrequence("Annuel (Saisonnier)", [8]), { type: "saisonniere", mois: [8] });
  assert.equal(lireFrequence(""), null);
  assert.equal(lireFrequence("Aux heures"), null);
  assert.equal(lireDateGmao("06/04/2026"), "2026-04-06");
  assert.equal(lireDateGmao("31/02/2026"), null);
  assert.equal(lireDateGmao(""), null);
  assert.deepEqual(lireRefs("89 , 90 , 91"), ["89", "90", "91"]);
  assert.deepEqual(lireQui("Sous-traitant", "Élite Énergie"), { type: "soustraitant", fournisseur: "Élite Énergie", repondant: "" });
  assert.deepEqual(lireQui("Frigoriste"), { type: "metier", metier: "Frigoriste" });
  assert.equal(fournisseurDe("Planifier l'inspection par Compresseur Drummond."), "Compresseur Drummond");
  assert.equal(regleComplete({ titre: "x", frequence: lireFrequence("Annuel"), prochaine: "2026-04-06", actifIds: ["a"], qui: lireQui("Frigoriste") }), true);
  assert.equal(regleComplete({ titre: "x", frequence: null, prochaine: "2026-04-06", actifIds: ["a"], qui: lireQui("Frigoriste") }), false);
});

test("retour après connexion : un chemin de l'app seulement", () => {
  assert.equal(cheminDeRetour("/salles/ZONE%20MULTI%205"), "/salles/ZONE%20MULTI%205");
  assert.equal(cheminDeRetour("/salles/CABANNE%20%232?x=1"), "/salles/CABANNE%20%232?x=1");
  for (const mauvais of ["https://evil.com", "//evil.com", "/\\evil.com", "/login", "/login?suite=/x", "/api/session", "/", "", null, "/a\nb"]) {
    assert.equal(cheminDeRetour(mauvais), null, String(mauvais));
  }
});
