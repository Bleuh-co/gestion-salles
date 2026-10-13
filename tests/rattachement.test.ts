import { test } from "node:test";
import assert from "node:assert/strict";
import { fenetresDeSalle, salleA, sejourEfface, sortDePeriode, type Periode } from "../src/lib/registre/rattachement.ts";
import { instantMontreal } from "../src/lib/registre/temps.ts";

// Déplacement temporaire d'un capteur : ZONE MULTI 4 → DÔME → ZONE MULTI 4.
const S = "Zone Multi 4C";
const POSE = instantMontreal("2026-05-26", "14:02");
const ALLER = instantMontreal("2026-10-14", "09:00");
const RETOUR = instantMontreal("2026-10-17", "16:30");

let n = 0;
const periode = (salleId: string | null, du: number, au: number | null, confirme = true): Periode => ({
  id: `p${++n}`, sensorId: S, sensorName: S, salleId, du, au, confirme, source: "manuel", par: "", parNom: "", inscritA: du, note: "",
});

/** Même règle que repo/rattachements.ts › rattacher, sans Firestore. */
function rattacher(periodes: Periode[], salleId: string | null, du: number): Periode[] {
  const apres: Periode[] = [];
  for (const p of periodes) {
    const sort = sortDePeriode(p, salleId, du);
    if (sort === "coupee") apres.push({ ...p, au: du });
    else if (sort === "gardee") apres.push(p);
  }
  return [...apres, periode(salleId, du, null)];
}

test("aller-retour : chaque salle garde les mesures de son séjour", () => {
  let ps = [periode("ZONE MULTI 4", POSE, null)];
  ps = rattacher(ps, "DÔME", ALLER);
  ps = rattacher(ps, "ZONE MULTI 4", RETOUR);
  assert.equal(ps.length, 3);
  assert.equal(salleA(ps, S, ALLER - 1), "ZONE MULTI 4");
  assert.equal(salleA(ps, S, ALLER), "DÔME");
  assert.equal(salleA(ps, S, RETOUR - 1), "DÔME");
  assert.equal(salleA(ps, S, RETOUR), "ZONE MULTI 4");
  const loin = instantMontreal("2026-12-31", "00:00");
  assert.deepEqual(fenetresDeSalle(ps, "DÔME", 0, loin).get(S), [{ du: ALLER, au: RETOUR }]);
  assert.deepEqual(fenetresDeSalle(ps, "ZONE MULTI 4", 0, loin).get(S), [
    { du: POSE, au: ALLER },
    { du: RETOUR, au: loin },
  ]);
});

test("aller-retour : le premier séjour « à confirmer » n'est plus effacé au retour", () => {
  let ps = [periode("ZONE MULTI 4", POSE, null, false)];
  ps = rattacher(ps, "DÔME", ALLER);
  ps = rattacher(ps, "ZONE MULTI 4", RETOUR);
  assert.equal(salleA(ps, S, POSE), "ZONE MULTI 4");
  assert.equal(salleA(ps, S, ALLER), "DÔME");
  assert.equal(salleA(ps, S, RETOUR), "ZONE MULTI 4");
});

test("changer de salle à la date d'arrivée efface le séjour : l'écran prévient", () => {
  const ps = [periode("ZONE MULTI 4", POSE, null)];
  assert.equal(sejourEfface(ps, S, "DÔME", POSE)?.salleId, "ZONE MULTI 4");
  assert.equal(sejourEfface(ps, S, "DÔME", POSE - 86_400_000)?.salleId, "ZONE MULTI 4");
  assert.equal(sejourEfface(ps, S, null, POSE)?.salleId, "ZONE MULTI 4");
  // Ce qu'on éviterait : tout le passé du capteur passerait dans le Dôme.
  const apres = rattacher(ps, "DÔME", POSE);
  assert.equal(fenetresDeSalle(apres, "ZONE MULTI 4", 0, ALLER).size, 0);
  assert.equal(salleA(apres, S, POSE), "DÔME");
});

test("pas d'avertissement pour un déplacement daté après l'arrivée, ni pour la date de pose corrigée", () => {
  const ps = [periode("ZONE MULTI 4", POSE, null)];
  assert.equal(sejourEfface(ps, S, "DÔME", ALLER), null);
  assert.equal(sejourEfface(ps, S, null, ALLER), null);
  assert.equal(sejourEfface(ps, S, "ZONE MULTI 4", POSE - 86_400_000), null);
  // Capteur retiré (aucune salle) : aucune salle ne perd de mesures.
  assert.equal(sejourEfface([periode(null, POSE, null)], S, "DÔME", POSE), null);
});

test("règles inchangées pour la date de pose (lot 0)", () => {
  const plusTard = instantMontreal("2026-05-28", "10:00");
  // Période en cours de la même salle : remplacée par la vraie date de pose.
  assert.equal(sortDePeriode(periode("ZONE MULTI 4", POSE, null), "ZONE MULTI 4", plusTard), "remplacee");
  // « À confirmer » qui dure encore à la nouvelle date : remplacée.
  assert.equal(sortDePeriode(periode("ZONE MULTI 4", POSE, ALLER, false), "ZONE MULTI 4", plusTard), "remplacee");
  // Confirmée, même salle, finie après la nouvelle date : coupée.
  assert.equal(sortDePeriode(periode("ZONE MULTI 4", POSE, ALLER), "ZONE MULTI 4", plusTard), "coupee");
  // Commence à la nouvelle date ou après : remplacée, quelle que soit la salle.
  assert.equal(sortDePeriode(periode("DÔME", plusTard, null), "ZONE MULTI 4", plusTard), "remplacee");
  // Autre salle, finie avant : gardée.
  assert.equal(sortDePeriode(periode("DÔME", POSE, plusTard), "ZONE MULTI 4", ALLER), "gardee");
});
