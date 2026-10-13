import { test } from "node:test";
import assert from "node:assert/strict";
import { DECALAGE_Y, PAS_Y, lirePoints, placerCapteur, type PlanCapteurs } from "../src/lib/plan-capteurs.ts";

// Repères relevés sur les plans le 13/10/2026 : les salles du BAT1 sont
// sur Bleuh-2 ; cinq d'entre elles sont aussi restées rangées au bord de Bleuh-1.
const bleuh1 = (): PlanCapteurs => ({
  id: "bleuh-1",
  nom: "Bleuh-1",
  ordre: 0,
  salles: {
    "SÉCHOIR 1 - ZONE MULTI": { x: 0.2198, y: 0.02 },
    "RÉCEPTION 1": { x: 0.1114, y: 0.02 },
  },
  capteurs: { TS00NNG55A: { x: 0.3321, y: 0.45, label: null } },
});
const bleuh2 = (): PlanCapteurs => ({
  id: "bleuh-2",
  nom: "Bleuh-2",
  ordre: 1,
  salles: {
    "SÉCHOIR 1 - ZONE MULTI": { x: 0.2142, y: 0.6369 },
    "RÉCEPTION 1": { x: 0.8951, y: 0.604 },
    "ZONE MULTI 7": { x: 0.8085, y: 0.6108 },
    "ENTREPÔT 1": { x: 0.861, y: 0.611 },
    "ZONE MULTI 8": { x: 0.7537, y: 0.6139 },
  },
  capteurs: {
    US00T4NTT2: { x: 0.1288, y: 0.6977, label: null },
    US002E7BAZ: { x: 0.2359, y: 0.6988, label: "Séchoir 2" },
  },
});
const BAT1 = () => "BAT1";

test("changement de salle : le point va sous le repère de la nouvelle salle", () => {
  const p = placerCapteur([bleuh1(), bleuh2()], "US00T4NTT2", "ZONE MULTI 7", BAT1);
  assert.deepEqual(p.cible, { planId: "bleuh-2", point: { x: 0.8085, y: 0.6258, label: null } });
  assert.deepEqual(p.retirerDe, []);
});

test("deux capteurs dans la même salle : le second va au rang suivant, et garde son étiquette", () => {
  const plans = [bleuh1(), bleuh2()];
  const premier = placerCapteur(plans, "US00T4NTT2", "ZONE MULTI 7", BAT1).cible!;
  plans[1].capteurs.US00T4NTT2 = premier.point;
  const second = placerCapteur(plans, "US002E7BAZ", "ZONE MULTI 7", BAT1).cible!;
  assert.equal(second.point.x, 0.8085);
  assert.equal(second.point.y, Math.round((0.6108 + DECALAGE_Y + PAS_Y) * 1e4) / 1e4);
  assert.equal(second.point.label, "Séchoir 2");
});

test("salle placée sur deux plans : celui qui place les salles de son bâtiment", () => {
  // Le capteur est sur Bleuh-1, mais Bleuh-2 place 5 salles du BAT1 contre 2.
  const p = placerCapteur([bleuh1(), bleuh2()], "TS00NNG55A", "SÉCHOIR 1 - ZONE MULTI", BAT1);
  assert.equal(p.cible?.planId, "bleuh-2");
  assert.deepEqual(p.retirerDe, ["bleuh-1"]);
});

test("à égalité, le capteur reste sur son plan", () => {
  const a = { ...bleuh1(), salles: { X: { x: 0.5, y: 0.5 } }, capteurs: {} };
  const b = { ...bleuh2(), salles: { X: { x: 0.2, y: 0.2 } }, capteurs: { S: { x: 0.9, y: 0.9, label: null } } };
  const p = placerCapteur([a, b], "S", "X", () => undefined);
  assert.equal(p.cible?.planId, "bleuh-2");
  assert.deepEqual(p.retirerDe, []);
});

test("salle placée sur aucun plan : le capteur quitte le plan", () => {
  const p = placerCapteur([bleuh1(), bleuh2()], "US00T4NTT2", "DÔME", BAT1);
  assert.equal(p.cible, null);
  assert.deepEqual(p.retirerDe, ["bleuh-2"]);
});

test("capteur retiré : il quitte tous les plans", () => {
  const plans = [bleuh1(), bleuh2()];
  plans[0].capteurs.US00T4NTT2 = { x: 0.1, y: 0.1, label: null };
  const p = placerCapteur(plans, "US00T4NTT2", null, BAT1);
  assert.equal(p.cible, null);
  assert.deepEqual(p.retirerDe, ["bleuh-1", "bleuh-2"]);
});

test("nouveau capteur, jamais placé : il apparaît dans sa salle", () => {
  const p = placerCapteur([bleuh1(), bleuh2()], "NOUVEAU", "ENTREPÔT 1", BAT1);
  assert.equal(p.cible?.planId, "bleuh-2");
  assert.deepEqual(p.retirerDe, []);
});

test("repère au bas de l'image : les points montent au lieu de sortir", () => {
  const plan = { ...bleuh2(), salles: { BAS: { x: 0.5, y: 0.975 } }, capteurs: {} };
  const p = placerCapteur([plan], "S", "BAS", () => undefined);
  assert.equal(p.cible?.point.y, Math.round((0.975 - DECALAGE_Y) * 1e4) / 1e4);
});

test("lecture Firestore : les points sans coordonnées sont ignorés", () => {
  assert.deepEqual(lirePoints({ A: { x: 0.1, y: "0.2" }, B: { x: null }, C: "?", D: { x: 0.3, y: 0.4, label: "D" } }), {
    A: { x: 0.1, y: 0.2, label: null },
    D: { x: 0.3, y: 0.4, label: "D" },
  });
  assert.deepEqual(lirePoints(undefined), {});
});
