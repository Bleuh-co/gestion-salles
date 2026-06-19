import { NextRequest, NextResponse } from "next/server";
import { getLocal } from "@/lib/data";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const { salleId } = await params;
  const local = getLocal(decodeURIComponent(salleId));
  if (!local) {
    return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
  }
  return NextResponse.json(local);
}
