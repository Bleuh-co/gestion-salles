import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import type { ItemAgricole } from "@/lib/types";
import { cached, invalidate } from "./cache";

// ============================================================
// Repo Items agricoles — collection "fa_inventory_items"
// écrite par l'app formulaire-achat (même Firestore).
// LECTURE SEULE ici : aucune écriture depuis gestion-salles.
// Seuls les documents avec agricole == true nous concernent.
// ============================================================

const COLLECTION = "fa_inventory_items";
const CACHE_KEY = "items-agricoles:all";

function docToItemAgricole(id: string, data: FirebaseFirestore.DocumentData): ItemAgricole {
  return {
    id,
    sku: data.sku ?? "",
    name: data.name ?? "",
    description: data.description ?? "",
    link: data.link ?? "",
    supplierName: data.supplierName ?? "",
    countingUnit: data.countingUnit ?? "",
    salleId: data.salleId ?? "",
  };
}

async function loadAll(): Promise<ItemAgricole[]> {
  const snap = await adminDb()
    .collection(COLLECTION)
    .where("agricole", "==", true)
    .get();
  return snap.docs
    .map((d) => docToItemAgricole(d.id, d.data()))
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
}

export async function getAllItemsAgricoles(): Promise<ItemAgricole[]> {
  return cached(CACHE_KEY, loadAll);
}

export function invalidateItemsAgricolesCache(): void {
  invalidate(CACHE_KEY);
}

export async function getItemsAgricolesBySalle(salleId: string): Promise<ItemAgricole[]> {
  const all = await getAllItemsAgricoles();
  return all.filter((it) => it.salleId === salleId);
}
