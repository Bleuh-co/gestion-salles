import { NextResponse } from "next/server";
import { getServiceAccountForGoogle } from "@/lib/firebase-admin";
import { FAMILLE_COLORS_FALLBACK } from "@/lib/types";

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
 * GET = read Listes_choix C+I
 * POST = write correct colors from FAMILLE_COLORS_FALLBACK
 */
export async function GET() {
  try {
    const token = await getToken();
    const res = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!C1:I15?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return NextResponse.json(await res.json());
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const token = await getToken();

    // 1. Read current families from column C
    const readRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!C1:C15?valueRenderOption=UNFORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const readData = (await readRes.json()) as { values?: string[][] };
    const rows = readData.values || [];

    // 2. Build column I values from FAMILLE_COLORS_FALLBACK
    const colI: string[][] = [["Couleur"]]; // header
    for (let i = 1; i < rows.length; i++) {
      const famille = rows[i]?.[0];
      if (famille && FAMILLE_COLORS_FALLBACK[famille]) {
        colI.push([FAMILLE_COLORS_FALLBACK[famille]]);
      } else {
        colI.push([""]);
      }
    }

    // 3. Write
    const writeRes = await fetch(
      `${API}/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!I1:I${colI.length}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: colI }),
      }
    );
    if (!writeRes.ok) return NextResponse.json({ error: await writeRes.text() }, { status: 500 });

    return NextResponse.json({
      status: "ok",
      written: Object.fromEntries(rows.slice(1).map((r, i) => [r?.[0] || `row${i}`, colI[i + 1]?.[0] || ""])),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
