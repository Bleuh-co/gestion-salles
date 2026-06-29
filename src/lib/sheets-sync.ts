import "server-only";
import { getServiceAccountForGoogle } from "./firebase-admin";

// ============================================================
// Google Sheets Sync — Écriture dans le sheet ChanvHQ
// ============================================================

const SHEET_ID = "1059QWs8VKKyF4jW0ThebEnM-qn2hMB-gpbq5gTB0Elk";
const LOCAUX_SHEET = "Locaux_ChanvHQ";
const ACTIFS_SHEET = "Actifs_ChanvHQ";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

// ============================================================
// Auth via service account
// ============================================================

let _accessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (_accessToken && Date.now() < _accessToken.expiresAt - 60_000) {
    return _accessToken.token;
  }

  const sa = getServiceAccountForGoogle();
  if (!sa) throw new Error("No service account configured for Google Sheets");

  // Use google-auth-library (transitive dep of firebase-admin)
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: sa,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
  if (!token) throw new Error("Failed to get access token");

  _accessToken = { token, expiresAt: Date.now() + 3500_000 };
  return token;
}

// ============================================================
// Helpers
// ============================================================

async function sheetsRequest(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${SHEETS_API}/${SHEET_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ============================================================
// Read helpers
// ============================================================

export async function readSheetRows(sheetName: string, range = "A1:Z1000"): Promise<string[][]> {
  const data = (await sheetsRequest(
    `/values/${encodeURIComponent(sheetName)}!${range}?valueRenderOption=UNFORMATTED_VALUE`
  )) as { values?: string[][] };
  return data.values || [];
}

// ============================================================
// Famille colors — lues depuis les couleurs de fond du sheet
// ============================================================

let _familleColorsCache: { colors: Record<string, string>; expiresAt: number } | null = null;
const FAMILLE_COLORS_TTL = 10 * 60_000; // 10 minutes

/**
 * Lit les couleurs de fond de la colonne "Famille de salle" (C) dans le
 * Google Sheet et retourne un mapping { famille: "#rrggbb" }.
 * Le résultat est caché en mémoire pendant 10 minutes.
 */
export async function readFamilleColors(): Promise<Record<string, string>> {
  // Retourne le cache s'il est encore valide
  if (_familleColorsCache && Date.now() < _familleColorsCache.expiresAt) {
    return _familleColorsCache.colors;
  }

  const token = await getAccessToken();

  // 1. Lire les valeurs de la colonne C (Famille de salle)
  const valuesUrl = `${SHEETS_API}/${SHEET_ID}/values/${encodeURIComponent(LOCAUX_SHEET)}!C:C?valueRenderOption=UNFORMATTED_VALUE`;
  const valuesRes = await fetch(valuesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!valuesRes.ok) throw new Error(`Sheets values error ${valuesRes.status}`);
  const valuesData = (await valuesRes.json()) as { values?: string[][] };
  const values = valuesData.values || [];

  // 2. Lire les couleurs de fond des cellules
  const formatUrl = `${SHEETS_API}/${SHEET_ID}?ranges=${encodeURIComponent(LOCAUX_SHEET)}!C:C&fields=sheets.data.rowData.values.effectiveFormat.backgroundColor`;
  const formatRes = await fetch(formatUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!formatRes.ok) throw new Error(`Sheets format error ${formatRes.status}`);
  const formatData = await formatRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowData: any[] =
    (formatData as any)?.sheets?.[0]?.data?.[0]?.rowData || [];

  // 3. Construire le mapping famille → couleur hex
  const colors: Record<string, string> = {};

  for (let i = 1; i < Math.min(values.length, rowData.length); i++) {
    const famille = values[i]?.[0];
    if (!famille || colors[famille]) continue; // skip header & déjà vu

    const bg = rowData[i]?.values?.[0]?.effectiveFormat?.backgroundColor;
    if (!bg) continue;

    // Ignorer les fonds blancs/par défaut (tous les composants ≥ 0.95)
    const r = Math.round((bg.red ?? 1) * 255);
    const g = Math.round((bg.green ?? 1) * 255);
    const b = Math.round((bg.blue ?? 1) * 255);
    if (r >= 245 && g >= 245 && b >= 245) continue; // blanc, pas de couleur

    colors[famille] = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  _familleColorsCache = { colors, expiresAt: Date.now() + FAMILLE_COLORS_TTL };
  return colors;
}

// ============================================================
// Locaux CRUD
// ============================================================

const LOCAUX_HEADERS = [
  "Bâtiment", "Étage", "Famille de salle", "ID_Salle", "NOM SALLE",
  "Prod", "ID_licence", "Code QR ID_Salle", "Vocation_Local (usage)",
  "Conditions ambiante", "Statut_Validation (actifs/locaux)", "Niveau d'accès",
];

const STATUT_TO_SHEET: Record<string, string> = {
  en_service: "Validé / En Service",
  en_construction: "En Construction",
  hors_service: "Hors Service",
  en_qualification: "En Qualification",
};

interface LocalSheetData {
  batiment: string;
  etage: string;
  famille: string;
  id: string;
  nomSalle?: string;
  prod: boolean;
  idLicence: string;
  vocation: string;
  conditions: string;
  statut: string;
  niveauAcces: string;
}

function localToRow(data: LocalSheetData): string[] {
  return [
    data.batiment,
    data.etage,
    data.famille,
    data.id,
    data.nomSalle || "",
    data.prod ? "O" : "N",
    data.idLicence,
    "",
    data.vocation,
    data.conditions,
    STATUT_TO_SHEET[data.statut] || data.statut,
    data.niveauAcces,
  ];
}

/**
 * Append a new local to the sheet
 */
export async function appendLocal(data: LocalSheetData): Promise<void> {
  const row = localToRow(data);
  await sheetsRequest(
    `/values/${encodeURIComponent(LOCAUX_SHEET)}!A:L:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    "POST",
    { values: [row] }
  );
}

/**
 * Find the row index of a local by ID_Salle (column D)
 */
async function findLocalRow(salleId: string): Promise<number | null> {
  const rows = await readSheetRows(LOCAUX_SHEET, "D:D");
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === salleId) return i + 1; // 1-indexed
  }
  return null;
}

/**
 * Update an existing local's row in the sheet
 */
export async function updateLocalInSheet(salleId: string, data: LocalSheetData): Promise<void> {
  const rowIndex = await findLocalRow(salleId);
  if (!rowIndex) throw new Error(`Local "${salleId}" introuvable dans le sheet`);
  const row = localToRow(data);
  await sheetsRequest(
    `/values/${encodeURIComponent(LOCAUX_SHEET)}!A${rowIndex}:L${rowIndex}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: [row] }
  );
}

/**
 * Archive a local: set its statut to "Hors Service" in the sheet
 */
export async function archiveLocalInSheet(salleId: string): Promise<void> {
  const rowIndex = await findLocalRow(salleId);
  if (!rowIndex) throw new Error(`Local "${salleId}" introuvable dans le sheet`);
  // Update column K (index 11 = statut) to "Hors Service"
  await sheetsRequest(
    `/values/${encodeURIComponent(LOCAUX_SHEET)}!K${rowIndex}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: [["Hors Service"]] }
  );
}

/**
 * Restore a local: set its statut to "En Construction" in the sheet
 */
export async function restoreLocalInSheet(salleId: string): Promise<void> {
  const rowIndex = await findLocalRow(salleId);
  if (!rowIndex) throw new Error(`Local "${salleId}" introuvable dans le sheet`);
  await sheetsRequest(
    `/values/${encodeURIComponent(LOCAUX_SHEET)}!K${rowIndex}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: [["En Construction"]] }
  );
}

// ============================================================
// Actifs CRUD
// ============================================================

interface ActifSheetData {
  id: string;
  matricule: string;
  idMasterlist: string;
  nom: string;
  idSalle: string;
  locauxDesservis: string;
  categorie: string;
  numeroSequence: string;
  marque: string;
  modele: string;
  numSerie: string;
  criticite: string;
  dateInstall: string;
  statut: string;
}

function actifToRow(data: ActifSheetData): string[] {
  return [
    data.id,
    data.matricule,
    data.idMasterlist,
    data.nom,
    data.idSalle,
    data.locauxDesservis,
    data.categorie,
    data.numeroSequence,
    "", // Locaux/Actifs_Déservies
    data.marque,
    data.modele,
    data.numSerie,
    "", // Photo_Plaque
    "", // Photo_Actif
    "", // Parent_ID
    data.criticite,
    data.dateInstall,
    data.statut,
  ];
}

export async function appendActif(data: ActifSheetData): Promise<void> {
  const row = actifToRow(data);
  await sheetsRequest(
    `/values/${encodeURIComponent(ACTIFS_SHEET)}!A:R:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    "POST",
    { values: [row] }
  );
}

async function findActifRow(actifId: string): Promise<number | null> {
  const rows = await readSheetRows(ACTIFS_SHEET, "A:A");
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(actifId)) return i + 1;
  }
  return null;
}

export async function updateActifInSheet(actifId: string, data: ActifSheetData): Promise<void> {
  const rowIndex = await findActifRow(actifId);
  if (!rowIndex) throw new Error(`Actif "${actifId}" introuvable dans le sheet`);
  const row = actifToRow(data);
  await sheetsRequest(
    `/values/${encodeURIComponent(ACTIFS_SHEET)}!A${rowIndex}:R${rowIndex}?valueInputOption=USER_ENTERED`,
    "PUT",
    { values: [row] }
  );
}
