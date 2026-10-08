import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { lire } from "@/lib/entretien/fichiers";
import { erreurEntretien } from "@/lib/entretien/routes";

// ============================================================
// GET /api/fichiers/<chemin> — photos et preuves de l'entretien,
// servies depuis le seau privé de l'app à toute personne connectée.
// ============================================================

interface Props {
  params: Promise<{ chemin: string[] }>;
}

export async function GET(_req: Request, { params }: Props) {
  try {
    await requireSession();
    const { chemin } = await params;
    const f = await lire(chemin.map((c) => decodeURIComponent(c)).join("/"));
    if (!f) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    return new NextResponse(new Uint8Array(f.contenu), {
      headers: {
        "content-type": f.type,
        "cache-control": "private, max-age=86400",
        "content-disposition": f.type === "application/pdf" ? "inline" : "inline",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    return erreurEntretien(e);
  }
}
