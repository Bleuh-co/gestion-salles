import { NextRequest, NextResponse } from "next/server";
import { getLocal } from "@/lib/repo/locaux";
import { getActifsBySalle } from "@/lib/repo/actifs";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { salleId } = await params;
  const id = decodeURIComponent(salleId);
  const local = await getLocal(id);
  if (!local) {
    return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
  }
  const actifs = await getActifsBySalle(id);
  return NextResponse.json(actifs);
}
