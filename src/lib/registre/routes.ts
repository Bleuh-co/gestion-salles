import "server-only";

import { NextResponse } from "next/server";
import type { SessionContext } from "@/lib/auth-server";
import { nomPersonne } from "@/lib/repo/personnes";
import type { Auteur } from "@/lib/repo/registre";
import { estJour, jourDe, midiDe } from "./temps";

// ============================================================
// Petits outils partagés par les routes du registre.
// ============================================================

export async function auteurDe(s: SessionContext): Promise<Auteur> {
  return { email: s.email, nom: s.displayName || (await nomPersonne(s.email)) };
}

export function reponseErreur(e: unknown): NextResponse {
  const message = e instanceof Error ? e.message : "Unknown error";
  if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  console.error("[registre]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Moment d'un geste daté au jour (déplacement « le 2 octobre ») :
 * aujourd'hui = maintenant ; un jour passé = midi ce jour-là.
 * null si la date est invalide ou dans le futur.
 */
export function momentDuJour(jour: unknown, maintenant = Date.now()): { at: string; jourSeulement: boolean } | null {
  if (jour === undefined || jour === null || jour === "") return { at: new Date(maintenant).toISOString(), jourSeulement: false };
  if (!estJour(jour)) return null;
  const aujourdHui = jourDe(maintenant);
  if (jour > aujourdHui) return null;
  if (jour === aujourdHui) return { at: new Date(maintenant).toISOString(), jourSeulement: false };
  return { at: new Date(midiDe(jour)).toISOString(), jourSeulement: true };
}

/** Texte libre court (motif, note) : null si vide, coupé à `max`. */
export function texteCourt(v: unknown, max = 300): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}
