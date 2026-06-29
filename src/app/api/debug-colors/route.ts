import { NextResponse } from "next/server";
import { getServiceAccountForGoogle } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * Debug v4 — read the Listes_choix sheet column D (source of the dropdown)
 * to find where the chip colors are actually defined.
 */
export async function GET() {
  try {
    const sa = getServiceAccountForGoogle();
    if (!sa) return NextResponse.json({ error: "No SA" }, { status: 500 });

    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: sa,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
    if (!token) return NextResponse.json({ error: "No token" }, { status: 500 });

    const SHEET_ID = "1059QWs8VKKyF4jW0ThebEnM-qn2hMB-gpbq5gTB0Elk";
    const API = "https://sheets.googleapis.com/v4/spreadsheets";

    // 1. Read Listes_choix column D values
    const valRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!D1:D30?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const valData = await valRes.json();

    // 2. Read Listes_choix column D formatting (backgrounds)
    const fmtRes = await fetch(
      `${API}/${SHEET_ID}?ranges=${encodeURIComponent("Listes_choix")}!D1:D30&fields=sheets.data.rowData.values(effectiveFormat.backgroundColor,effectiveFormat.backgroundColorStyle,userEnteredFormat.backgroundColor)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fmtData = await fmtRes.json();

    // 3. Read ALL of Listes_choix first few rows to see full structure
    const allRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!A1:H20?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const allData = await allRes.json();

    // 4. Read Listes_choix full formatting for columns A-H rows 1-20
    const fullFmtRes = await fetch(
      `${API}/${SHEET_ID}?ranges=${encodeURIComponent("Listes_choix")}!A1:H20&fields=sheets.data.rowData.values(effectiveFormat.backgroundColor,effectiveFormat.textFormat.foregroundColor,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.foregroundColor)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fullFmtData = await fullFmtRes.json();

    return NextResponse.json({
      status: "ok",
      listes_choix_colD_values: valData,
      listes_choix_colD_formatting: fmtData,
      listes_choix_all_values: allData,
      listes_choix_all_formatting: fullFmtData,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
