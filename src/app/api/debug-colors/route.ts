import { NextResponse } from "next/server";
import { getServiceAccountForGoogle } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const INITIAL_COLORS: [string, string][] = [
  ["Couleur", ""],         // header row
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

/**
 * One-time setup: writes initial hex colors to Listes_choix column I.
 * GET = read current state, POST = write colors.
 */
export async function GET() {
  try {
    const token = await getToken();
    const API = "https://sheets.googleapis.com/v4/spreadsheets";
    const SHEET_ID = "1059QWs8VKKyF4jW0ThebEnM-qn2hMB-gpbq5gTB0Elk";

    // Read current column I
    const res = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!I1:I15?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    // Also read C column to show mapping
    const cRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!C1:C15?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const cData = await cRes.json();

    return NextResponse.json({
      status: "ok",
      columnI_current: data,
      columnC_familles: cData,
      instruction: "POST to this endpoint to write initial colors to column I",
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const token = await getToken();
    const API = "https://sheets.googleapis.com/v4/spreadsheets";
    const SHEET_ID = "1059QWs8VKKyF4jW0ThebEnM-qn2hMB-gpbq5gTB0Elk";

    // Write colors to column I (rows 1-11)
    const values = INITIAL_COLORS.map(([color]) => [color]);
    const res = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!I1:I11?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Sheets write error: ${text}` }, { status: 500 });
    }

    const result = await res.json();
    return NextResponse.json({
      status: "ok",
      message: "Colors written to Listes_choix!I1:I11",
      result,
      colorsWritten: Object.fromEntries(INITIAL_COLORS.slice(1).map(([c, f]) => [f, c])),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

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
