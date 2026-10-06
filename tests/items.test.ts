import { test } from "node:test";
import assert from "node:assert/strict";
import { repriseItem } from "../src/lib/registre/items.ts";
import { decrireLigne } from "../src/lib/registre/libelles.ts";
import { translator } from "../src/lib/i18n-dict.ts";
import type { LigneRegistre } from "../src/lib/registre/types.ts";

const SALLES = new Set(["ZONE MULTI 9", "ZONE MULTI 4"]);
const MAINTENANT = Date.UTC(2026, 9, 6, 18);
const CREE = Date.UTC(2026, 7, 20, 14);

test("reprise : jamais modifié depuis sa création = ajouté dans la salle, à cette date, par son auteur", () => {
  const r = repriseItem({ agricole: true, salleId: "ZONE MULTI 9", createdAt: CREE, createdBy: "m.tremblay@chanv.com" }, SALLES, MAINTENANT);
  assert.deepEqual(r, { salleId: "ZONE MULTI 9", action: "item_ajoute", at: CREE, par: "m.tremblay@chanv.com" });
});

test("reprise : modifié depuis = présent, depuis sa dernière modification seulement", () => {
  const modifie = Date.UTC(2026, 8, 2, 15);
  const r = repriseItem({ agricole: true, salleId: "ZONE MULTI 4", createdAt: CREE, createdBy: "a@chanv.com", updatedAt: modifie }, SALLES, MAINTENANT);
  assert.deepEqual(r, { salleId: "ZONE MULTI 4", action: "item_present", at: modifie, par: "" });
  // Sans date de création : présent à la reprise.
  assert.equal(repriseItem({ agricole: true, salleId: "ZONE MULTI 4" }, SALLES, MAINTENANT)?.at, MAINTENANT);
});

test("reprise : rien pour un item standard ou une salle inconnue", () => {
  assert.equal(repriseItem({ salleId: "ZONE MULTI 9", createdAt: CREE }, SALLES, MAINTENANT), null);
  assert.equal(repriseItem({ agricole: true, salleId: "SALLE CHANV 1", createdAt: CREE }, SALLES, MAINTENANT), null);
  assert.equal(repriseItem({ agricole: true, createdAt: CREE }, SALLES, MAINTENANT), null);
});

test("textes des lignes d'actif agricole, dont celles inscrites par Demande d'achats", () => {
  const f = { t: translator("fr"), locale: "fr-CA", noms: { "ZONE MULTI 4": "Salle pouponnière" } };
  const base: LigneRegistre = {
    id: "x",
    sorte: "item",
    t: MAINTENANT,
    type: "item_sorti",
    salleId: "ZONE MULTI 9",
    par: "a@chanv.com",
    parNom: "Ana",
    source: "app",
    cible: { type: "item", id: "it1", nom: "Terreau Pro-Mix", matricule: "AGR-0001" },
    autreSalle: "ZONE MULTI 4",
    details: { app: "demande-achats" },
  };
  const d = decrireLigne(base, f);
  assert.equal(d.titre, "Actif agricole déplacé vers ZONE MULTI 4 · Salle pouponnière : Terreau Pro-Mix (AGR-0001)");
  assert.equal(d.detail, "inscrit aussi au registre de ZONE MULTI 4 · Salle pouponnière · inscrit par l'app Demande d'achats");
  const m = decrireLigne({ ...base, type: "item_modifie", autreSalle: null, changes: { nom: { before: "Terreau", after: "Terreau Pro-Mix" } } }, f);
  assert.equal(m.titre, "Actif agricole modifié : Terreau Pro-Mix (AGR-0001) — Nom : Terreau → Terreau Pro-Mix");
  const p = decrireLigne({ ...base, type: "item_present", autreSalle: null, source: "reprise", details: { creeA: new Date(CREE).toISOString() } }, f);
  assert.match(p.detail, /^repris à l'ouverture du registre ; créé le 20 août 2026 dans Demande d'achats/);
});
