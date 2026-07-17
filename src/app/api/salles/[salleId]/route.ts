import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { getLocal } from "@/lib/repo/locaux";

interface Props {
  params: Promise<{ salleId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { salleId } = await params;
  const local = await getLocal(decodeURIComponent(salleId));
  if (!local) {
    return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
  }
  return NextResponse.json(local);
}
