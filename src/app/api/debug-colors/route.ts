import { NextResponse } from "next/server";
import { getServiceAccountForGoogle } from "@/lib/firebase-admin";

export const runtime = "nodejs";

async function getToken(): Promise<string> {
  const sa = getServiceAccountForGoogle();
  if (!sa) throw new Error("No service account");
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({
    credentials: sa,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
  if (!token) throw new Error("No token");
  return token;
}

const SHEET_ID = "1059QWs8VKKyF4jW0ThebEnM-qn2hMB-gpbq5gTB0Elk";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * GET ?sheet=Plan_ChanvHQ&range=A1:Z5 — read any sheet/range
 * GET without params — read Listes_choix C+I
 * POST — seed colors to column I
 */
export async function GET(req: Request) {
  try {
    const token = await getToken();
    const url = new URL(req.url);
    const sheet = url.searchParams.get("sheet") || "Listes_choix";
    const range = url.searchParams.get("range") || "A1:Z20";
    const fmt = url.searchParams.get("fmt"); // "1" to include formatting

    // Values
    const valRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent(sheet)}!${range}?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const valData = await valRes.json();

    let fmtData = null;
    if (fmt) {
      const fmtRes = await fetch(
        `${API}/${SHEET_ID}?ranges=${encodeURIComponent(sheet)}!${range}&fields=sheets.data.rowData.values(effectiveFormat.backgroundColor,userEnteredFormat.backgroundColor)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fmtData = await fmtRes.json();
    }

    return NextResponse.json({ status: "ok", values: valData, formatting: fmtData });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

const INITIAL_COLORS: [string, string][] = [
  ["Couleur", ""],
  ["#22c55e", "CANNABIS"],
  ["#8b5cf6", "PSN"],
  ["#f59e0b", "ALI"],
  ["#06b6d4", "CANNABIS_R&D"],
  ["#6366f1", "BUREAUX"],
  ["#94a3b8", "ZONES COMMUNES"],
  ["#ef4444", "SERVICES TECHNIQUES"],
  ["#f97316", "SERVICES PRODUCTION"],
  ["#84cc16", "MAISON D'HERBES"],
  ["#3b82f6", "BLEUH"],
];

export async function POST() {
  try {
    const token = await getToken();
    const values = INITIAL_COLORS.map(([color]) => [color]);
    const res = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!I1:I11?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      }
    );
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
    return NextResponse.json({ status: "ok", result: await res.json() });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
