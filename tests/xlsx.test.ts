import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { classeur } from "../src/lib/xlsx.ts";

/** Lit une archive zip (répertoire central) : nom → contenu. */
function dezip(buf: Buffer): Map<string, string> {
  const fin = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(fin > 0, "fin de répertoire central");
  const n = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const out = new Map<string, string>();
  for (let i = 0; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const taille = buf.readUInt32LE(p + 20);
    const lnom = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const nom = buf.subarray(p + 46, p + 46 + lnom).toString("utf8");
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    out.set(nom, inflateRawSync(buf.subarray(debut, debut + taille)).toString("utf8"));
    p += 46 + lnom;
  }
  return out;
}

test("classeur : archive lisible, un onglet par feuille, texte échappé", () => {
  const buf = classeur([
    { nom: "Résumé", colonnes: [{ titre: "Champ" }, { titre: "Valeur" }], lignes: [["Salle", "ZONE MULTI 5 <froide> & co"]] },
    { nom: "Par jour", colonnes: [{ titre: "Jour" }, { titre: "T min (°C)", decimales: 2 }], lignes: [["2026-10-05", 2.92]] },
    { nom: "Par jour", colonnes: [{ titre: "x" }], lignes: [] },
  ]);
  const f = dezip(buf);
  assert.deepEqual(
    [...f.keys()].sort(),
    [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet2.xml",
      "xl/worksheets/sheet3.xml",
    ].sort()
  );
  const wb = f.get("xl/workbook.xml")!;
  assert.match(wb, /name="Résumé"/);
  // Deux onglets du même nom : le second est renommé.
  assert.match(wb, /name="Par jour 2"/);
  const s1 = f.get("xl/worksheets/sheet1.xml")!;
  assert.match(s1, /ZONE MULTI 5 &lt;froide&gt; &amp; co/);
  const s2 = f.get("xl/worksheets/sheet2.xml")!;
  assert.match(s2, /<c r="B2" s="4"><v>2.92<\/v><\/c>/);
  assert.match(s2, /state="frozen"/);
});
