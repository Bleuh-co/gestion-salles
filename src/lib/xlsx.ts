// ============================================================
// Écriture de fichiers Excel (.xlsx) sans dépendance.
//
// Un .xlsx est une archive zip de quelques fichiers XML
// (SpreadsheetML). On écrit le strict nécessaire : un onglet par
// feuille, une ligne d'en-tête en gras figée avec filtre, des
// largeurs de colonnes, des nombres et du texte (chaînes en ligne,
// sans table partagée). La compression vient de node:zlib.
// ============================================================

import { deflateRawSync } from "node:zlib";

export type Cellule = string | number | null | undefined;

export interface Feuille {
  /** Nom de l'onglet (31 caractères au plus, sans : \ / ? * [ ]). */
  nom: string;
  colonnes: { titre: string; largeur?: number; decimales?: number }[];
  lignes: Cellule[][];
}

// ---- Zip (méthode « deflate », sans chiffrement) ---------------------------

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zip(fichiers: { nom: string; contenu: string | Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  // Date DOS fixe (1er janvier 2026) : le fichier ne dépend que de son contenu.
  const heure = 0;
  const date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, "utf8");
    const brut = typeof f.contenu === "string" ? Buffer.from(f.contenu, "utf8") : f.contenu;
    const comp = deflateRawSync(brut);
    const crc = crc32(brut);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // noms en UTF-8
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(heure, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(nom.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nom, comp);

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(heure, 12);
    c.writeUInt16LE(date, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20);
    c.writeUInt32LE(brut.length, 24);
    c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nom);
    offset += 30 + nom.length + comp.length;
  }
  const dir = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(dir.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, fin]);
}

// ---- SpreadsheetML ---------------------------------------------------------

function xml(s: string): string {
  return s
    // Caractères interdits en XML 1.0 (sauf tabulation et retours).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colonne(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Nom d'onglet valide et unique. */
function nomOnglet(nom: string, pris: Set<string>): string {
  const base = (nom.replace(/[:\\/?*[\]]/g, " ").trim() || "Feuille").slice(0, 31);
  let n = base;
  for (let k = 2; pris.has(n.toLowerCase()); k++) n = `${base.slice(0, 28)} ${k}`;
  pris.add(n.toLowerCase());
  return n;
}

// Styles : 0 = normal, 1 = en-tête gras sur fond fibre, 2..5 = nombres à 0..3 décimales.
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="0.0"/><numFmt numFmtId="165" formatCode="0.00"/><numFmt numFmtId="166" formatCode="0.000"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1EADA"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function feuilleXml(f: Feuille): string {
  const ncol = Math.max(1, f.colonnes.length);
  const cols = f.colonnes
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largeur ?? Math.min(60, Math.max(10, c.titre.length + 2))}" customWidth="1"/>`)
    .join("");
  const cellule = (v: Cellule, l: number, c: number, entete: boolean): string => {
    const ref = `${colonne(c)}${l}`;
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "number" && Number.isFinite(v) && !entete) {
      const d = f.colonnes[c]?.decimales;
      const s = d === undefined ? 0 : 2 + Math.min(3, Math.max(0, d));
      return `<c r="${ref}"${s ? ` s="${s}"` : ""}><v>${v}</v></c>`;
    }
    return `<c r="${ref}" t="inlineStr"${entete ? ' s="1"' : ""}><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
  };
  const lignes = [f.colonnes.map((c) => c.titre), ...f.lignes]
    .map((row, i) => `<row r="${i + 1}">${row.map((v, j) => cellule(v, i + 1, j, i === 0)).join("")}</row>`)
    .join("");
  const der = `${colonne(ncol - 1)}${f.lignes.length + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${lignes}</sheetData>${f.lignes.length ? `<autoFilter ref="A1:${der}"/>` : ""}
</worksheet>`;
}

/** Classeur .xlsx à partir de feuilles. */
export function classeur(feuilles: Feuille[]): Buffer {
  const pris = new Set<string>();
  const noms = feuilles.map((f) => nomOnglet(f.nom, pris));
  const n = feuilles.length;
  const fichiers: { nom: string; contenu: string }[] = [
    {
      nom: "[Content_Types].xml",
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    },
    {
      nom: "_rels/.rels",
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nom: "xl/workbook.xml",
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${noms
        .map((nm, i) => `<sheet name="${xml(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets>${feuilles.some((f) => f.lignes.length)
        ? `<definedNames>${feuilles
            .map((f, i) =>
              f.lignes.length
                ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(noms[i]).replace(/'/g, "''")}'!$A$1:$${colonne(Math.max(1, f.colonnes.length) - 1)}$${f.lignes.length + 1}</definedName>`
                : ""
            )
            .join("")}</definedNames>`
        : ""}</workbook>`,
    },
    {
      nom: "xl/_rels/workbook.xml.rels",
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { nom: "xl/styles.xml", contenu: STYLES },
    ...feuilles.map((f, i) => ({ nom: `xl/worksheets/sheet${i + 1}.xml`, contenu: feuilleXml(f) })),
  ];
  return zip(fichiers);
}
