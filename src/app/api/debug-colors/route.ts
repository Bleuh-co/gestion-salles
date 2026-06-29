import { NextResponse } from "next/server";
import { getServiceAccountForGoogle } from "@/lib/firebase-admin";

export const runtime = "nodejs";

/**
 * Debug endpoint — reads data validation chip colors from column G
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
    const SHEET_NAME = "Locaux_ChanvHQ";
    const API = "https://sheets.googleapis.com/v4/spreadsheets";

    // Read EVERYTHING: effectiveFormat, dataValidation, userEnteredFormat
    const fullRes = await fetch(
      `${API}/${SHEET_ID}?ranges=${encodeURIComponent(SHEET_NAME)}!G1:G10&fields=sheets.data.rowData.values(effectiveFormat,dataValidation,userEnteredFormat)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const fullData = await fullRes.json();

    // Also try reading the data validation rules for the whole column
    const dvRes = await fetch(
      `${API}/${SHEET_ID}?ranges=${encodeURIComponent(SHEET_NAME)}!G1:G10&fields=sheets.data.rowData.values.dataValidation`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const dvData = await dvRes.json();

    // Also read the entire sheet metadata for conditionalFormats and basicFilter
    const metaRes = await fetch(
      `${API}/${SHEET_ID}?fields=sheets(conditionalFormats,basicFilter,properties,bandedRanges)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const metaData = await metaRes.json();

    return NextResponse.json({
      status: "ok",
      columnG_full_formatting: fullData,
      columnG_dataValidation: dvData,
      sheet_metadata: metaData,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
