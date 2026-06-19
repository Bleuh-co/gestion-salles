import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getSalle } from "@/lib/data";

// GET .../readings — lectures capteurs (SensorReading[])
// TODO: implémenter — voir Antigravity.md
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ usineId: string; salleId: string }> }
) {
  await requireSession();
  const { usineId, salleId } = await params;
  const salle = getSalle(usineId, salleId);
  return NextResponse.json(salle?.capteurs ?? []);
}
