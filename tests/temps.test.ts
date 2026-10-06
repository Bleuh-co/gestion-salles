import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ajouterJours,
  debutJour,
  finJour,
  heureDe,
  jourDe,
  joursEntre,
  lireHeureUtc,
  midiDe,
} from "../src/lib/registre/temps.ts";

const H = 3600_000;

test("jour et heure de Montréal d'un instant UTC", () => {
  // 16 h 55 UTC le 6 octobre = 12 h 55 à Montréal (heure d'été).
  const t = Date.UTC(2026, 9, 6, 16, 55);
  assert.equal(jourDe(t), "2026-10-06");
  assert.equal(heureDe(t), "12:55");
  // 2 h UTC le 7 octobre = encore le 6 à Montréal.
  assert.equal(jourDe(Date.UTC(2026, 9, 7, 2, 0)), "2026-10-06");
});

test("début et fin d'un jour, y compris aux changements d'heure", () => {
  assert.equal(debutJour("2026-10-06"), Date.UTC(2026, 9, 6, 4, 0));
  assert.equal(debutJour("2026-01-15"), Date.UTC(2026, 0, 15, 5, 0));
  // Passage à l'heure d'été (8 mars 2026) : journée de 23 h.
  assert.equal(finJour("2026-03-08") - debutJour("2026-03-08"), 23 * H);
  // Retour à l'heure normale (1er novembre 2026) : journée de 25 h.
  assert.equal(finJour("2026-11-01") - debutJour("2026-11-01"), 25 * H);
  assert.equal(heureDe(midiDe("2026-03-08")), "12:00");
  assert.equal(heureDe(midiDe("2026-11-01")), "12:00");
});

test("arithmétique des jours", () => {
  assert.equal(ajouterJours("2026-02-28", 1), "2026-03-01");
  assert.equal(ajouterJours("2026-10-06", -30), "2026-09-06");
  assert.deepEqual(joursEntre("2026-09-29", "2026-10-02"), [
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
  ]);
});

test("heures TempStick", () => {
  assert.equal(lireHeureUtc("2026-10-06 16:55:12Z"), Date.UTC(2026, 9, 6, 16, 55, 12));
  assert.equal(lireHeureUtc("2026-05-26 19:03:31"), Date.UTC(2026, 4, 26, 19, 3, 31));
  assert.equal(lireHeureUtc(""), null);
  assert.equal(lireHeureUtc(undefined), null);
});
