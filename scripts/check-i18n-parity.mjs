#!/usr/bin/env node
/**
 * Vérifie la parité STRICTE ×3 du dictionnaire i18n (fr/en/es) :
 *  - même ensemble de clés dans les trois langues,
 *  - aucune valeur vide,
 *  - mêmes placeholders {var} dans chaque langue.
 * Usage : npm run check:i18n
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/lib/i18n-dict.ts"), "utf8");

// Évalue le module TS en le réduisant à du JS (types effacés grossièrement).
const js = src
  .replace(/^import[^\n]*\n/gm, "")
  .replace(/export type [^;]+;?/g, "")
  .replace(/const (\w+):[^=]+=/g, "const $1 =")
  .replace(/\(s: string, vars\?: Vars\): string/g, "(s, vars)")
  .replace(/\(lang: Lang\)/g, "(lang)")
  .replace(/\(key: string, vars\?: Vars\): string/g, "(key, vars)")
  .replace(/\(v: string \| undefined \| null\): Lang/g, "(v)")
  .replace(/export /g, "");
const MESSAGES = new Function(`${js}; return MESSAGES;`)();

const langs = ["fr", "en", "es"];
const keys = Object.fromEntries(langs.map((l) => [l, Object.keys(MESSAGES[l] || {})]));
let errors = 0;

for (const l of langs) {
  if (!MESSAGES[l]) {
    console.error(`✗ langue manquante : ${l}`);
    errors++;
  }
}

const all = new Set(langs.flatMap((l) => keys[l]));
for (const key of all) {
  const holders = {};
  for (const l of langs) {
    const v = MESSAGES[l]?.[key];
    if (v === undefined) {
      console.error(`✗ ${l} : clé manquante « ${key} »`);
      errors++;
      continue;
    }
    if (typeof v !== "string" || v.trim() === "") {
      console.error(`✗ ${l} : valeur vide pour « ${key} »`);
      errors++;
      continue;
    }
    holders[l] = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  }
  const uniq = new Set(Object.values(holders));
  if (uniq.size > 1) {
    console.error(`✗ placeholders divergents pour « ${key} » : ${JSON.stringify(holders)}`);
    errors++;
  }
}

// Doublons de clés littérales dans le source (dernier gagne silencieusement).
for (const l of langs) {
  const block = src.split(`${l}: {`)[1]?.split("\n  },")[0] || "";
  const seen = new Map();
  for (const m of block.matchAll(/^\s{4}"([^"]+)":/gm)) {
    seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  }
  for (const [k, n] of seen) {
    if (n > 1) {
      console.error(`✗ ${l} : clé dupliquée « ${k} » (${n}×)`);
      errors++;
    }
  }
}

if (errors) {
  console.error(`\n${errors} erreur(s) de parité i18n.`);
  process.exit(1);
}
console.log(`✓ Parité i18n stricte ×3 : ${all.size} clés × ${langs.length} langues, placeholders alignés.`);
