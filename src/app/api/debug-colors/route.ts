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

export async function GET(req: Request) {
  try {
    const token = await getToken();
    const url = new URL(req.url);
    const sheet = url.searchParams.get("sheet") || "Locaux_ChanvHQ";
    const range = url.searchParams.get("range") || "G2:G12";

    // Read ALL cell data including dataValidation chip colors
    const res = await fetch(
      `${API}/${SHEET_ID}?ranges=${encodeURIComponent(sheet)}!${range}&includeGridData=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({ status: "disabled" });
}
