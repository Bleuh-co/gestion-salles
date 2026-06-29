import { NextResponse } from "next/server";
import { FAMILLE_COLORS_FALLBACK } from "@/lib/types";
import { getServiceAccountForGoogle } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * Debug endpoint — dumps raw Sheets API data for column C (values)
 * and column G (formatting) to diagnose why colors aren't loading.
 */
export async function GET() {
  try {
    const sa = getServiceAccountForGoogle();
    if (!sa) {
      return NextResponse.json({ error: "No service account" }, { status: 500 });
    }

    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: sa,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 500 });
    }

    const SHEET_ID = "1059QWs8VKKyF4jW0ThebEnM-qn2hMB-gpbq5gTB0Elk";
    const SHEET_NAME = "Locaux_ChanvHQ";
    const API = "https://sheets.googleapis.com/v4/spreadsheets";

    // 1. Read column C values (famille names)
    const valRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!C1:C10?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const valData = await valRes.json();

    // 2. Read column G values (ID_licence text)
    const gValRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!G1:G10?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const gValData = await gValRes.json();

    // 3. Read column G formatting (background colors)
    const fmtRes = await fetch(
      `${API}/${SHEET_ID}?ranges=${encodeURIComponent(SHEET_NAME)}!G1:G10&fields=sheets.data.rowData.values.effectiveFormat.backgroundColor`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fmtData = await fmtRes.json();

    // 4. Also try column C formatting for comparison
    const fmtCRes = await fetch(
      `${API}/${SHEET_ID}?ranges=${encodeURIComponent(SHEET_NAME)}!C1:C10&fields=sheets.data.rowData.values.effectiveFormat.backgroundColor`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fmtCData = await fmtCRes.json();

    // 5. Read ALL columns row 1-3 to see full structure
    const allRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}!A1:L3?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const allData = await allRes.json();

    return NextResponse.json({
      status: "ok",
      columnC_values: valData,
      columnG_values: gValData,
      columnG_formatting: fmtData,
      columnC_formatting: fmtCData,
      allColumns_first3rows: allData,
      fallbackColors: FAMILLE_COLORS_FALLBACK,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
