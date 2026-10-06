// ============================================================
// Items agricoles au registre (lot 6) — module pur.
//
// Les items agricoles vivent dans fa_inventory_items, écrits par l'app
// Demande d'achats (formulaire-achat). C'est elle qui inscrit chaque
// ajout, déplacement, modification ou suppression dans le registre des
// salles (formulaire-achat, src/lib/registre-salles.ts), avec la même
// forme de ligne que src/lib/repo/registre.ts.
//
// Ici : la reprise, une seule fois, des items déjà rattachés à une salle
// avant que Demande d'achats n'inscrive quoi que ce soit.
// ============================================================

export interface ItemSource {
  agricole?: boolean;
  salleId?: string;
  /** ms */
  createdAt?: number;
  createdBy?: string;
  /** ms */
  updatedAt?: number;
}

export interface RepriseItem {
  salleId: string;
  action: "item_ajoute" | "item_present";
  /** ms */
  at: number;
  par: string;
}

/**
 * Ligne de reprise d'un item agricole.
 * - Jamais modifié depuis sa création : il a été créé dans cette salle
 *   (« ajouté », à sa date de création, par la personne qui l'a créé).
 * - Modifié depuis : la salle a pu changer ; on sait seulement qu'il y
 *   est depuis sa dernière modification (« présent »).
 * null si l'item n'est pas agricole ou si sa salle n'existe pas.
 */
export function repriseItem(it: ItemSource, salles: Set<string>, maintenant: number): RepriseItem | null {
  if (!it.agricole || !it.salleId || !salles.has(it.salleId)) return null;
  const cree = typeof it.createdAt === "number" && Number.isFinite(it.createdAt) ? it.createdAt : null;
  const modifie = typeof it.updatedAt === "number" && Number.isFinite(it.updatedAt) ? it.updatedAt : null;
  if (cree != null && (modifie == null || modifie - cree < 60_000)) {
    return { salleId: it.salleId, action: "item_ajoute", at: cree, par: it.createdBy ?? "" };
  }
  return { salleId: it.salleId, action: "item_present", at: modifie ?? maintenant, par: "" };
}
