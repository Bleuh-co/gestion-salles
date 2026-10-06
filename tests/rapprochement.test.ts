import { test } from "node:test";
import assert from "node:assert/strict";
import { matchSensorToRoom, matchAllSensors } from "../src/lib/sensor-match-core.ts";
import { proposerSalle } from "../src/lib/registre/orphelins.ts";
import fx from "./fixtures/salles-capteurs.json" with { type: "json" };

// Salles et capteurs réels relevés le 6 octobre 2026 (codes et noms seulement).
const ids = fx.salles.map((s) => s.id);

test("les rattachements par le nom d'avant le lot 0 ne changent pas", () => {
  const avant: Record<string, string> = {
    "Zone Multi 9C": "ZONE MULTI 9",
    "Zone Multi 1C": "ZONE MULTI 1",
    "Zone Multi 2C": "ZONE MULTI 2",
    "Zone Multi 4C": "ZONE MULTI 4",
    "Zone Multi 6C": "ZONE MULTI 6",
    "Zone Multi 8": "ZONE MULTI 8",
  };
  for (const [nom, salle] of Object.entries(avant)) {
    assert.equal(matchSensorToRoom(nom, ids), salle, nom);
  }
});

test("le rapprochement tolérant rattache les trois capteurs évidents", () => {
  assert.equal(matchSensorToRoom("Zone Multi 5 (chambre froide)", ids), "ZONE MULTI 5");
  assert.equal(matchSensorToRoom("Sechoir 1 Zone Multi C", ids), "SÉCHOIR 1 - ZONE MULTI");
  assert.equal(matchSensorToRoom("Sechoir 2 Zone Multi C", ids), "SÉCHOIR 2 - ZONE MULTI");
  // Rattaché à la main le 25 juin : le nom mène à la même salle.
  assert.equal(matchSensorToRoom("Sechoir 3 Zone Multi C", ids), "SÉCHOIR 3 - ZONE MULTI");
});

test("les noms sans code de salle restent sans salle", () => {
  for (const nom of fx.capteurs.filter((n) => /^SECHOIR\d+$/.test(n) || n === "Salle 102")) {
    assert.equal(matchSensorToRoom(nom, ids), null, nom);
  }
});

test("sur les 22 capteurs : 10 par le nom, 12 sans salle avant tout choix manuel", () => {
  const sensors = fx.capteurs.map((n, i) => ({
    sensor_id: `s${i}`,
    sensor_name: n,
    last_temp_c: null,
    last_humidity: null,
    last_checkin_utc: null,
    offline: false,
    battery: null,
  }));
  const res = matchAllSensors(sensors, ids, new Map());
  assert.equal(res.filter((r) => r.match_source === "auto").length, 10);
  assert.equal(res.filter((r) => r.match_source === "none").length, 12);
});

test("un choix manuel l'emporte sur le nom", () => {
  const s = {
    sensor_id: "x",
    sensor_name: "Zone Multi 4C",
    last_temp_c: null,
    last_humidity: null,
    last_checkin_utc: null,
    offline: false,
    battery: null,
  };
  const [r] = matchAllSensors([s], ids, new Map([["x", "ZONE MULTI 6"]]));
  assert.equal(r.matched_local_id, "ZONE MULTI 6");
  assert.equal(r.match_source, "override");
});

test("une clé tolérante partagée par deux salles ne rattache rien", () => {
  assert.equal(matchSensorToRoom("Salle A-1 C", ["SALLE A 1", "SALLE A-1"]), null);
});

test("salle proposée pour les codes orphelins du relevé", () => {
  const cas: [string, string | null, string][] = [
    ["SALLE CHANV FABRICATION", "ZONE MULTI 14", "probable"],
    ["SALLE CHANV 1", "ZONE MULTI 13", "meme_nom"],
    ["SALLE CHANV 2", "ZONE MULTI 15", "meme_nom"],
    ["EMBOUTEILLAGE", null, "a_decider"],
    ["BUREAUX AQ", "BUR8", "probable"],
    ["SALLE DES CHANDELLES", "ZONE MULTI 12", "meme_nom"],
    ["SALLE DE FABRICATION", "ZONE MULTI 14", "probable"],
    ["ADS15", null, "a_decider"],
    ["ZONE MULTI 6, ZONE MULTI 4", null, "a_decider"],
    ["BRISÉ NE PAS UTILISER", null, "a_decider"],
  ];
  for (const [code, salle, certitude] of cas) {
    assert.deepEqual(proposerSalle(code, fx.salles), { salleId: salle, certitude }, code);
  }
});
