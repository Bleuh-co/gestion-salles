import { NextRequest, NextResponse } from "next/server";
import { getLocaux } from "@/lib/repo/locaux";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const famille = url.searchParams.get("famille") || undefined;
  const etage = url.searchParams.get("etage") || undefined;
  const statut = url.searchParams.get("statut") || undefined;
  const q = url.searchParams.get("q") || undefined;

  const locaux = await getLocaux({ famille, etage, statut, q });

  return NextResponse.json(locaux);
}
