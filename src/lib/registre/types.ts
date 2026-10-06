// ============================================================
// Types du registre par salle, partagés serveur / client.
// ============================================================

import type { Grandeur } from "./mesures.ts";

/** Sorte d'une ligne du registre (filtres de l'onglet Registre). */
export type SorteLigne = "fiche" | "actif" | "item" | "capteur" | "ecart" | "note" | "export";

export type ActionEvenement =
  | "ouverture"
  | "salle_creee"
  | "fiche_modifiee"
  | "salle_archivee"
  | "salle_restauree"
  | "salle_supprimee"
  | "plage_modifiee"
  | "actif_installe"
  | "actif_ajoute"
  | "actif_entre"
  | "actif_sorti"
  | "actif_retire"
  | "actif_modifie"
  | "actif_supprime"
  | "actif_corrige"
  | "dessert_ajoute"
  | "dessert_retire"
  | "registre_exporte"
  // Lot 5 : notes sur place et justification d'un écart calculé.
  | "note"
  | "ecart_justifie"
  // Lot 6 : items agricoles, inscrits par l'app Demande d'achats
  // (formulaire-achat, src/lib/registre-salles.ts) ; « présent » = reprise.
  | "item_ajoute"
  | "item_present"
  | "item_entre"
  | "item_sorti"
  | "item_modifie"
  | "item_supprime";

export interface CibleEvenement {
  type: "local" | "actif" | "capteur" | "item";
  id: string;
  nom: string;
  matricule?: string;
}

export type Changements = Record<string, { before: string; after: string }>;

/** Ligne écrite dans registre_salles/{salleId}/evenements. */
export interface EvenementSalle {
  id: string;
  salleId: string;
  /** Moment du fait (ISO UTC). */
  at: string;
  /** Fait daté au jour (déplacement saisi « le 2 octobre ») : l'heure n'a pas de sens. */
  jourSeulement?: boolean;
  /** Moment de l'inscription (ISO UTC). */
  inscritA: string;
  action: ActionEvenement;
  par: string;
  parNom: string;
  cible?: CibleEvenement | null;
  changes?: Changements | null;
  /** Autre salle d'un déplacement. */
  autreSalle?: string | null;
  motif?: string | null;
  note?: string | null;
  details?: Record<string, unknown> | null;
  source: "app" | "reprise";
}

/** Ligne affichée : événement écrit, ou ligne calculée (capteur, écart, silence). */
export interface LigneRegistre {
  id: string;
  sorte: SorteLigne;
  /** ms UTC */
  t: number;
  jourSeulement?: boolean;
  type:
    | ActionEvenement
    | "capteur_pose"
    | "capteur_parti"
    | "capteur_nouveau"
    | "ecart"
    | "muet";
  salleId: string | null;
  par: string;
  parNom: string;
  /** Inscription différée (geste daté dans le passé) : ms UTC. */
  inscritA?: number;
  source: "app" | "reprise" | "calcul" | "rattachement" | "fournisseur";
  cible?: CibleEvenement | null;
  changes?: Changements | null;
  autreSalle?: string | null;
  motif?: string | null;
  note?: string | null;
  details?: Record<string, unknown> | null;
}

/** Plage cible d'une salle (V5). */
export interface PlagesSalle {
  tempMin: number | null;
  tempMax: number | null;
  humMin: number | null;
  humMax: number | null;
  /** Relevés de suite hors plage avant de parler d'écart (2 par défaut). */
  seuil: number;
}

export interface EcartLigne {
  grandeur: Grandeur;
  sens: "haut" | "bas";
  extreme: number;
  dureeMin: number;
  n: number;
  enCours: boolean;
  capteur: string;
  plage: string;
}
