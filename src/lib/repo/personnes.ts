import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { cached } from "./cache";

// ============================================================
// Noms des personnes (users/{email}.name du hub), pour afficher
// « Maxime Tremblay » plutôt qu'une adresse dans le registre.
// ============================================================

const TTL = 10 * 60_000;

/** Nom affichable d'une adresse ; à défaut, la partie avant @. */
export async function nomPersonne(email: string): Promise<string> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  if (!e.includes("@")) return email;
  return cached(
    `personne:${e}`,
    async () => {
      try {
        const doc = await adminDb().collection("users").doc(e).get();
        const name = doc.data()?.name;
        if (typeof name === "string" && name.trim()) return name.trim();
      } catch {
        /* nom indisponible : repli sur l'adresse */
      }
      return e.split("@")[0];
    },
    TTL
  );
}

/** Noms de plusieurs adresses (une lecture par adresse inconnue du cache). */
export async function nomsPersonnes(emails: string[]): Promise<Map<string, string>> {
  const uniques = [...new Set(emails.filter(Boolean))];
  const noms = await Promise.all(uniques.map((e) => nomPersonne(e)));
  return new Map(uniques.map((e, i) => [e, noms[i]]));
}
