import { test } from "node:test";
import assert from "node:assert/strict";
import {
  relevesUniques,
  calculerEcarts,
  calculerMuets,
  moyenneParPas,
  parJour,
  resumerParJour,
  statsPeriode,
  type Releve,
} from "../src/lib/registre/mesures.ts";
import { debutJour, finJour, heureDe, jourDe } from "../src/lib/registre/temps.ts";
import { fenetresDeSalle, proposerDatePose, salleA, type Periode } from "../src/lib/registre/rattachement.ts";
import cf from "./fixtures/chambre-froide-aout.json" with { type: "json" };

const MIN = 60_000;
const Q = 15 * MIN;
const reel: Releve[] = cf.releves.map(([s, c, h]) => ({ t: s * 1000, c, h }));

/** Série régulière toutes les 15 min à partir de t0. */
function serie(t0: number, valeurs: number[], h = 85): Releve[] {
  return valeurs.map((c, i) => ({ t: t0 + i * Q, c, h }));
}

test("écart : deux relevés de suite hors plage, fin au premier relevé revenu", () => {
  const t0 = Date.UTC(2026, 8, 1, 12);
  const rs = serie(t0, [4, 5, 9.4, 9.1, 8.6, 6, 5]);
  const [e, ...reste] = calculerEcarts(rs, "c", { min: 2, max: 8 }, Q);
  assert.equal(reste.length, 0);
  assert.equal(e.sens, "haut");
  assert.equal(e.debut, t0 + 2 * Q);
  assert.equal(e.fin, t0 + 5 * Q);
  assert.equal(e.extreme, 9.4);
  assert.equal(e.n, 3);
  assert.equal(e.enCours, false);
});

test("une porte ouverte un instant (un seul relevé) n'est pas un écart", () => {
  const rs = serie(Date.UTC(2026, 8, 1), [4, 9.5, 4, 4, 1.2, 4]);
  assert.deepEqual(calculerEcarts(rs, "c", { min: 2, max: 8 }, Q), []);
});

test("sans plage, aucun écart ; plage d'un seul côté acceptée", () => {
  const rs = serie(Date.UTC(2026, 8, 1), [-19, -19, -19]);
  assert.deepEqual(calculerEcarts(rs, "c", null, Q), []);
  assert.deepEqual(calculerEcarts(rs, "c", { min: null, max: null }, Q), []);
  assert.deepEqual(calculerEcarts(rs, "c", { min: null, max: -18 }, Q), []);
  const [e] = calculerEcarts(rs, "c", { min: null, max: -20 }, Q);
  assert.equal(e.sens, "haut");
  // Aucun relevé revenu dans la plage : l'écart est encore en cours.
  assert.equal(e.enCours, true);
  assert.equal(e.fin, rs[2].t + Q);
});

test("capteur muet : silence de deux relevés attendus ou plus", () => {
  const t0 = Date.UTC(2026, 8, 1, 4);
  const rs: Releve[] = [0, 1, 2, 28, 29].map((k) => ({ t: t0 + k * Q, c: 3, h: 85 }));
  const fen = { du: t0, au: t0 + 30 * Q };
  const muets = calculerMuets(rs, fen, Q, t0 + 30 * Q);
  assert.equal(muets.length, 1);
  assert.equal(muets[0].debut, t0 + 2 * Q);
  assert.equal(muets[0].fin, t0 + 28 * Q);
  assert.equal(muets[0].manquants, 25);
  // Un seul relevé manquant (30 min de silence) n'est pas un silence.
  const un = [0, 1, 3, 4].map((k) => ({ t: t0 + k * Q, c: 3, h: 85 }));
  assert.deepEqual(calculerMuets(un, { du: t0, au: t0 + 5 * Q }, Q, t0 + 5 * Q), []);
  // Silence en cours à la fin des données.
  const fin = calculerMuets(rs, { du: t0, au: t0 + 60 * Q }, Q, t0 + 40 * Q);
  assert.equal(fin[fin.length - 1].enCours, true);
});

test("résumé par jour : reçus, attendus, min, max, moyenne", () => {
  const jour = "2026-08-16";
  const d = debutJour(jour);
  const rs = reel.filter((r) => r.t >= d && r.t < finJour(jour));
  const [r] = resumerParJour(
    [{ sensorId: "cf", nom: "cf", intervalleMs: Q, fenetres: [{ du: d, au: finJour(jour) }], releves: reel }],
    [jour],
    [],
    Date.UTC(2026, 9, 6)
  );
  assert.equal(r.recus, rs.length);
  assert.equal(r.attendus, 96);
  assert.equal(r.cMin, Math.min(...rs.map((x) => x.c as number)));
  assert.equal(r.cMax, Math.max(...rs.map((x) => x.c as number)));
  assert.equal(r.partiel, false);
  assert.equal(r.minutesHorsPlage, 0);
});

test("le jour en cours est partiel et n'attend pas les relevés futurs", () => {
  const jour = "2026-08-16";
  const midi = debutJour(jour) + 12 * 3600_000;
  const [r] = resumerParJour(
    [{ sensorId: "cf", nom: "cf", intervalleMs: Q, fenetres: [{ du: debutJour(jour), au: Infinity }], releves: reel }],
    [jour],
    [],
    midi
  );
  assert.equal(r.attendus, 48);
  assert.equal(r.partiel, true);
});

test("chambre froide : la date de pose proposée suit la bascule du 14 août", () => {
  const t = proposerDatePose(reel, jourDe);
  assert.ok(t);
  assert.equal(jourDe(t), "2026-08-14");
  // Sorti du congélateur vers 9 h ; mesures stables à partir de 11 h 38.
  assert.equal(heureDe(t), "11:38");
});

test("le registre de la salle ne reprend pas les mesures d'avant la pose", () => {
  const pose = proposerDatePose(reel, jourDe)!;
  const periodes: Periode[] = [
    { id: "a", sensorId: "cf", sensorName: "Zone Multi 5 (chambre froide)", salleId: null, du: 0, au: pose, confirme: true, source: "reprise", par: "", parNom: "", inscritA: 0, note: "" },
    { id: "b", sensorId: "cf", sensorName: "Zone Multi 5 (chambre froide)", salleId: "ZONE MULTI 5", du: pose, au: null, confirme: true, source: "manuel", par: "", parNom: "", inscritA: 0, note: "" },
  ];
  assert.equal(salleA(periodes, "cf", pose - 1), null);
  assert.equal(salleA(periodes, "cf", pose), "ZONE MULTI 5");
  const du = debutJour("2026-08-12");
  const au = finJour("2026-08-17");
  const fen = fenetresDeSalle(periodes, "ZONE MULTI 5", du, au).get("cf")!;
  const s = statsPeriode(
    [{ sensorId: "cf", nom: "cf", intervalleMs: Q, fenetres: fen, releves: reel }],
    du,
    au,
    { min: 2, max: 8 },
    null,
    au
  );
  assert.ok(s.c.min!.v >= 2, `minimum ${s.c.min!.v}`);
  assert.ok(s.c.max!.v <= 8, `maximum ${s.c.max!.v}`);
  assert.equal(s.ecarts.length, 0);
  assert.equal(s.depuis, pose);
  // Avant la pose, le même capteur mesurait −19 °C : la salle ne le voit pas.
  assert.ok(Math.min(...reel.map((r) => r.c as number)) < -18);
});

test("un relevé envoyé deux fois à la même seconde ne compte qu'une fois", () => {
  // TempStick, chambre froide, 2 octobre 2026 à 17:10:12 UTC : 97 relevés reçus pour 96 instants.
  const t = Date.UTC(2026, 9, 2, 17, 10, 12);
  const rs = [{ t, c: 3.4, h: 85 }, { t: t - Q, c: 3.3, h: 85 }, { t, c: 3.4, h: 85 }];
  assert.deepEqual(relevesUniques(rs).map((r) => r.t), [t - Q, t]);
});

test("moyennes par heure et par jour", () => {
  const t0 = Date.UTC(2026, 8, 1, 10);
  const rs = serie(t0, [1, 2, 3, 4, 10, 10, 10, 10]);
  assert.deepEqual(
    moyenneParPas(rs, "c", 3600_000).map((p) => p.v),
    [2.5, 10]
  );
  const [j] = parJour(rs, "c");
  assert.equal(j.min, 1);
  assert.equal(j.max, 10);
  assert.equal(j.moy, 6.25);
});
