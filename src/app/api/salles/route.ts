import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getLocaux } from "@/lib/repo/locaux";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = req.nextUrl;
  const famille = url.searchParams.get("famille") || undefined;
  const etage = url.searchParams.get("etage") || undefined;
  const statut = url.searchParams.get("statut") || undefined;
  const q = url.searchParams.get("q") || undefined;

  const locaux = await getLocaux({ famille, etage, statut, q });

  return NextResponse.json(locaux);
}
