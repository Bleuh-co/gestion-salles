import { NextRequest, NextResponse } from "next/server";
import { getActifsBySalle, getLocal } from "@/lib/data";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { salleId } = await params;
  const id = decodeURIComponent(salleId);
  const local = getLocal(id);
  if (!local) {
    return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
  }
  const actifs = getActifsBySalle(id);
  return NextResponse.json(actifs);
}
