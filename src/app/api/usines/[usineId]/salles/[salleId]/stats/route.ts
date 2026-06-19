import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getSalle } from "@/lib/data";

// GET .../stats — statistiques (RoomStats)
// TODO: implémenter — voir Antigravity.md
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ usineId: string; salleId: string }> }
) {
  await requireSession();
  const { usineId, salleId } = await params;
  const salle = getSalle(usineId, salleId);
  if (!salle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(salle.stats);
}
