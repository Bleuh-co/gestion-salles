import { NextRequest, NextResponse } from "next/server";
import { getLocal } from "@/lib/repo/locaux";
import { getItemsAgricolesBySalle } from "@/lib/repo/items-agricoles";

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
  const items = await getItemsAgricolesBySalle(id);
  return NextResponse.json(items);
}
