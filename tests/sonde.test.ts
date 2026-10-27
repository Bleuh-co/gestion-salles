import { test } from "node:test";
import assert from "node:assert/strict";
import { derniereMesure, mesuresDesReleves, temperatureSonde } from "../src/lib/sensors/sonde.ts";

// Valeurs de /sensors/all le 27/10/2026 : CONTENEUR#1 (EX004HGTYF) et un capteur sans sonde.
const conteneur1 = { sensor_id: "EX004HGTYF", type: "EX", last_temp: 7.36, last_humidity: 37.8, TC_M: 1, last_tcTemp: "-21.06" };
const sechoir1 = { sensor_id: "US00NGCYD7", type: "US", last_temp: 17.61, last_humidity: 45.2 };

test("un conteneur affiche la sonde, sans l'humidité du boîtier", () => {
  assert.deepEqual(derniereMesure(conteneur1), { c: -21.06, h: null, sonde: true });
});

test("un capteur sans sonde garde sa température et son humidité", () => {
  assert.deepEqual(derniereMesure(sechoir1), { c: 17.61, h: 45.2, sonde: false });
});

test("une sonde absente ou débranchée ne remplace pas le boîtier", () => {
  for (const v of [null, undefined, "", "-9999", "abc"]) {
    assert.equal(temperatureSonde(v), null, String(v));
    assert.equal(derniereMesure({ ...conteneur1, last_tcTemp: v }).c, 7.36);
  }
});

test("les relevés d'un capteur à sonde prennent tous la sonde", () => {
  const releves = [
    { temperature: 25.23, humidity: 37.8, tcTemp: 24.06, sensor_time: "2026-10-26 20:12:00Z" },
    { temperature: 7.4, humidity: 37.9, sensor_time: "2026-10-27 18:10:39Z" },
    { temperature: 7.36, humidity: 37.8, tcTemp: -21.06, sensor_time: "2026-10-27 19:10:39Z" },
  ];
  assert.deepEqual(mesuresDesReleves(releves), [
    { c: 24.06, h: null },
    { c: null, h: null },
    { c: -21.06, h: null },
  ]);
});

test("les relevés d'un capteur sans sonde ne changent pas", () => {
  assert.deepEqual(mesuresDesReleves([{ temperature: 17.6, humidity: 45 }]), [{ c: 17.6, h: 45 }]);
});
