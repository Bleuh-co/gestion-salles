import { test } from "node:test";
import assert from "node:assert/strict";
import { lireJustification, lireNote, MAX_TEXTE, peutNoter, viseEcart } from "../src/lib/registre/notes.ts";
import { decrireLigne } from "../src/lib/registre/libelles.ts";
import { instantMontreal } from "../src/lib/registre/temps.ts";
import { translator } from "../src/lib/i18n-dict.ts";
import type { LigneRegistre } from "../src/lib/registre/types.ts";

const MAINTENANT = Date.UTC(2026, 9, 6, 18, 30); // 6 octobre 2026, 14 h 30 à Montréal
const H = 3600_000;

test("gestionnaires et administrateurs notent ; Consulter lit seulement", () => {
  assert.equal(peutNoter("gestionnaire"), true);
  assert.equal(peutNoter("admin"), true);
  assert.equal(peutNoter("superadmin"), true);
  assert.equal(peutNoter("membre"), false);
  assert.equal(peutNoter("blocked"), false);
  assert.equal(peutNoter(undefined), false);
});

test("note : maintenant par défaut, texte nettoyé et borné", () => {
  const n = lireNote({ categorie: "degivrage", texte: "  porte ouverte 20 min  " }, MAINTENANT);
  assert.deepEqual(n, { categorie: "degivrage", texte: "porte ouverte 20 min", t: MAINTENANT });
  const long = lireNote({ categorie: "observation", texte: "x".repeat(MAX_TEXTE + 50) }, MAINTENANT);
  assert.ok(!("erreur" in long) && long.texte.length === MAX_TEXTE);
});

test("note datée plus tôt : heure de Montréal, ni future ni de plus d'un an", () => {
  const n = lireNote({ categorie: "nettoyage", texte: "lavage", jour: "2026-10-06", heure: "09:15" }, MAINTENANT);
  assert.ok(!("erreur" in n));
  assert.equal(n.t, Date.UTC(2026, 9, 6, 13, 15)); // 9 h 15 HAE = 13 h 15 UTC
  assert.equal(n.t, instantMontreal("2026-10-06", "09:15"));
  assert.deepEqual(lireNote({ categorie: "nettoyage", texte: "x", jour: "2026-10-06", heure: "16:00" }, MAINTENANT), { erreur: "quand" });
  assert.deepEqual(lireNote({ categorie: "nettoyage", texte: "x", jour: "2025-09-01", heure: "08:00" }, MAINTENANT), { erreur: "quand" });
  assert.deepEqual(lireNote({ categorie: "nettoyage", texte: "x", jour: "2026-10-06", heure: "9h15" }, MAINTENANT), { erreur: "quand" });
  assert.deepEqual(lireNote({ categorie: "nettoyage", texte: "x", jour: "6 octobre", heure: "09:15" }, MAINTENANT), { erreur: "quand" });
});

test("note : sorte et texte obligatoires", () => {
  assert.deepEqual(lireNote({ categorie: "reparation", texte: "x" }, MAINTENANT), { erreur: "categorie" });
  assert.deepEqual(lireNote({ categorie: "intervention", texte: "   " }, MAINTENANT), { erreur: "texte" });
  assert.deepEqual(lireNote(null, MAINTENANT), { erreur: "categorie" });
});

test("justification : écart désigné par capteur, grandeur et début", () => {
  const ok = lireJustification({ sensorId: "TS-1", grandeur: "c", debut: MAINTENANT - 5 * H, texte: " livraison " }, MAINTENANT);
  assert.deepEqual(ok, { sensorId: "TS-1", grandeur: "c", debut: MAINTENANT - 5 * H, texte: "livraison" });
  assert.deepEqual(lireJustification({ sensorId: "TS-1", grandeur: "t", debut: MAINTENANT, texte: "x" }, MAINTENANT), { erreur: "ecart" });
  assert.deepEqual(lireJustification({ grandeur: "c", debut: MAINTENANT, texte: "x" }, MAINTENANT), { erreur: "ecart" });
  assert.deepEqual(lireJustification({ sensorId: "TS-1", grandeur: "h", debut: MAINTENANT + H, texte: "x" }, MAINTENANT), { erreur: "ecart" });
  assert.deepEqual(lireJustification({ sensorId: "TS-1", grandeur: "h", debut: MAINTENANT, texte: "" }, MAINTENANT), { erreur: "texte" });
});

test("une justification suit son écart, même s'il s'allonge ; pas un autre", () => {
  const j = { sensorId: "TS-1", grandeur: "c" as const, debut: 10 * H, fin: 11 * H };
  assert.equal(viseEcart(j, { ...j }), true);
  // Écart en cours au moment de la justification, fini plus tard.
  assert.equal(viseEcart(j, { ...j, fin: 15 * H }), true);
  // Affiché sur une période qui le coupait : il commence en fait plus tôt.
  assert.equal(viseEcart(j, { ...j, debut: 8 * H }), true);
  assert.equal(viseEcart(j, { ...j, sensorId: "TS-2" }), false);
  assert.equal(viseEcart(j, { ...j, grandeur: "h" }), false);
  assert.equal(viseEcart(j, { ...j, debut: 12 * H, fin: 13 * H }), false);
});

function ligne(p: Partial<LigneRegistre>): LigneRegistre {
  return { id: "x", sorte: "note", t: MAINTENANT, type: "note", salleId: "ZONE MULTI 5", par: "", parNom: "", source: "app", ...p };
}

test("textes : note, écart justifié, justification restée seule", () => {
  const f = { t: translator("fr"), locale: "fr-CA" };
  const note = decrireLigne(ligne({ note: "Dégivrage de l'évaporateur, porte ouverte 20 min", details: { categorie: "degivrage" } }), f);
  assert.equal(note.titre, "Note (dégivrage) : « Dégivrage de l'évaporateur, porte ouverte 20 min »");
  assert.equal(note.detail, "");

  const ecart = decrireLigne(
    ligne({
      sorte: "ecart",
      type: "ecart",
      source: "calcul",
      cible: { type: "capteur", id: "TS-1", nom: "Zone Multi 5" },
      details: {
        grandeur: "c", sens: "haut", extreme: 9.4, dureeMin: 40, n: 3, enCours: false, min: 2, max: 8,
        justifications: [{ texte: "porte ouverte pendant la livraison", parNom: "Maxime Tremblay", inscritA: MAINTENANT }],
      },
    }),
    f
  );
  assert.match(ecart.titre, /^Écart : jusqu'à 9,4 °C pendant 40 min/);
  assert.match(ecart.detail, /Justifié par Maxime Tremblay le .+ : « porte ouverte pendant la livraison »$/);

  const seule = decrireLigne(
    ligne({
      sorte: "ecart",
      type: "ecart_justifie",
      note: "dégivrage",
      cible: { type: "capteur", id: "TS-1", nom: "Zone Multi 5" },
      details: { grandeur: "c", debut: MAINTENANT - 2 * H },
    }),
    f
  );
  assert.equal(seule.titre, "Justification d'un écart : « dégivrage »");
  assert.match(seule.detail, /^Température · écart du .+ · Zone Multi 5$/);
});

test("textes en anglais et en espagnol : aucune clé manquante", () => {
  for (const lang of ["en", "es"] as const) {
    const f = { t: translator(lang), locale: lang };
    const d = decrireLigne(ligne({ note: "x", details: { categorie: "intervention" } }), f);
    assert.doesNotMatch(d.titre, /ligne\.|note\./);
  }
});
