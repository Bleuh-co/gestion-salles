import "server-only";

import { NextResponse } from "next/server";
import type { SessionContext } from "@/lib/auth-server";
import { nomPersonne } from "@/lib/repo/personnes";
import { peutNoter } from "@/lib/registre/notes";
import { HubRefus } from "./gandalf";
import { ErreurEntretien, type Acteur } from "./service";
import type { Intervention } from "./types";

// ============================================================
// Outils des routes de l'entretien : qui agit, qui a le droit, erreurs.
// ============================================================

export async function acteurDe(s: SessionContext): Promise<Acteur> {
  return { uid: s.uid, email: s.email.toLowerCase(), nom: s.displayName || (await nomPersonne(s.email)) };
}

/** Gestionnaire ou administrateur : tient le plan, assigne, valide (plan, 2.9). */
export function estGestionnaire(s: SessionContext): boolean {
  return peutNoter(s.role);
}

export function estAdmin(s: SessionContext): boolean {
  return s.role === "admin" || s.role === "superadmin";
}

/** L'intervenant (personne assignée) ou un gestionnaire. */
export function peutFaire(s: SessionContext, iv: Pick<Intervention, "assignes">): boolean {
  return estGestionnaire(s) || iv.assignes.includes(s.email.toLowerCase());
}

export function erreurEntretien(e: unknown): NextResponse {
  if (e instanceof ErreurEntretien || e instanceof HubRefus) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : "Unknown error";
  if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (message === "TYPE") return NextResponse.json({ error: "Type de fichier refusé (photo ou PDF)." }, { status: 415 });
  if (message === "TAILLE") return NextResponse.json({ error: "Fichier trop lourd (15 Mo au plus)." }, { status: 413 });
  console.error("[entretien]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}
