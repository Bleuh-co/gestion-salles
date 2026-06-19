import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getUsine } from "@/lib/data";

// GET /api/usines/[usineId] — détail usine + ses salles
// TODO: implémenter — voir Antigravity.md
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ usineId: string }> }
) {
  await requireSession();
  const { usineId } = await params;
  const usine = getUsine(usineId);
  if (!usine) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(usine);
}
