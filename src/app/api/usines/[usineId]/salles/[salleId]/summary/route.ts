import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getRoomSummary } from "@/lib/data";

// GET .../summary — résumé salle (RoomSummary)
// TODO: implémenter — voir Antigravity.md
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ usineId: string; salleId: string }> }
) {
  await requireSession();
  const { usineId, salleId } = await params;
  const summary = getRoomSummary(usineId, salleId);
  if (!summary) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(summary);
}
