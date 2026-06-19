import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { getSalle } from "@/lib/data";

// GET .../devices — appareils IoT (Device[])
// TODO: implémenter — voir Antigravity.md
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ usineId: string; salleId: string }> }
) {
  await requireSession();
  const { usineId, salleId } = await params;
  const salle = getSalle(usineId, salleId);
  return NextResponse.json(salle?.devices ?? []);
}
