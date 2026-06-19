import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getUsines } from "@/lib/data";

// GET /api/usines — liste toutes les usines (sans salles détaillées)
// TODO: implémenter — voir Antigravity.md
export async function GET() {
  await requireSession();
  const usines = getUsines().map(({ salles, ...rest }) => rest);
  return NextResponse.json(usines);
}
