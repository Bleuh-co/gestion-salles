// ============================================================
// Entretien des équipements — types partagés serveur / client.
//
// Une règle d'entretien (entretien_regles) décrit un travail qui
// revient : quels équipements, quelle fréquence, qui le fait, quelle
// preuve. Une intervention (entretien_interventions) est une
// occurrence de règle ou un problème signalé ; elle devient une
// tâche GANDALF quand sa fenêtre s'ouvre ou quand on l'assigne.
// Plan du 7 octobre 2026 (plans-chanv, « L'entretien des
// équipements dans Gestion des Salles »).
// ============================================================

export type UniteFrequence = "jour" | "semaine" | "mois" | "an";

/**
 * Fréquence d'une règle :
 *  - périodique : tous les n jours, semaines, mois ou ans ;
 *  - saisonnière : une fois par an, pendant les mois permis (1–12) ;
 *  - ponctuelle : une seule fois.
 * « Aux heures » (compteur de fonctionnement) n'existe pas encore.
 */
export type Frequence =
  | { type: "periodique"; n: number; unite: UniteFrequence }
  | { type: "saisonniere"; mois: number[] }
  | { type: "ponctuelle" };

/** D5 : la suivante se calcule depuis la date prévue (défaut) ou depuis la date où c'est fait. */
export type ModeCalcul = "prevue" | "faite";

export type PreuveExigee = "aucune" | "photo" | "rapport" | "mesure";

/** Qui fait : une personne, un corps de métier (personne par défaut réglée), ou un sous-traitant et son répondant. */
export type Qui =
  | { type: "personne"; email: string }
  | { type: "metier"; metier: string }
  | { type: "soustraitant"; fournisseur: string; repondant: string };

export type EtatRegle = "active" | "a_completer" | "archivee";

export interface OrigineRegle {
  source: "gmao" | "gandalf" | "app";
  /** Identifiants d'origine : PM-G005, 4d7e45a9… */
  refs: string[];
}

export interface Regle {
  id: string;
  titre: string;
  /** Type de travail (liste de la GMAO : « Préventif (Planifié) », « Qualité / Calibration »…). */
  type: string;
  consigne: string;
  procedureUrl: string;
  actifIds: string[];
  /** Salles visées sans équipement (bâtiment, extincteurs…) ; s'ajoutent à celles des équipements. */
  salleIds: string[];
  /** Équipement nommé hors inventaire (« Génératrice (455) ») tant qu'il n'est pas retrouvé. */
  equipementLibre: string;
  frequence: Frequence | null;
  /** Prochaine échéance (AAAA-MM-JJ) ; null = à planifier. */
  prochaine: string | null;
  calcul: ModeCalcul;
  /** La tâche apparaît N jours avant l'échéance ; null = selon la fréquence. */
  fenetreJours: number | null;
  qui: Qui | null;
  checklist: string[];
  preuve: PreuveExigee;
  /** Unité de la valeur mesurée (preuve « mesure »). */
  mesureUnite: string;
  criticite: string;
  etat: EtatRegle;
  origine: OrigineRegle | null;
  /** Remarque libre (reprise, audit). */
  remarque: string;
  creeA: string;
  creePar: string;
  modifieA: string;
  modifiePar: string;
}

export type GenreIntervention = "preventif" | "probleme";

/**
 * Vie d'une intervention (plan, 2.5) :
 * à assigner → à faire (tâche GANDALF créée) → en cours ⇄ en attente
 * → à valider (terminé, avec la preuve) → validée ; ou annulée.
 */
export type StatutIntervention =
  | "a_assigner"
  | "a_faire"
  | "en_cours"
  | "en_attente"
  | "a_valider"
  | "validee"
  | "annulee";

export const STATUTS_OUVERTS: StatutIntervention[] = ["a_assigner", "a_faire", "en_cours", "en_attente"];
export const STATUTS_FERMES: StatutIntervention[] = ["validee", "annulee"];

export interface Personne {
  email: string;
  nom: string;
}

export interface Fichier {
  /** Objet du seau de l'app (servi par /api/fichiers), ou lien d'une pièce jointe GANDALF. */
  chemin?: string;
  url?: string;
  nom: string;
  type: string;
  taille?: number;
  par: string;
  parNom: string;
  a: string;
}

export interface EtapeChecklist {
  texte: string;
  fait: boolean;
}

export interface Intervention {
  id: string;
  genre: GenreIntervention;
  regleId: string | null;
  titre: string;
  consigne: string;
  type: string;
  actifIds: string[];
  salleIds: string[];
  equipementLibre: string;
  /** Échéance (AAAA-MM-JJ) ; pour un problème, selon la priorité. */
  echeance: string | null;
  /** Jour d'ouverture de la fenêtre (préventif). */
  ouverture: string | null;
  /** 0 (urgence sécurité) à 5 (faible) — problèmes signalés. */
  priorite: number | null;
  criticite: string;
  statut: StatutIntervention;
  assignes: string[];
  checklist: EtapeChecklist[];
  preuveExigee: PreuveExigee;
  mesureUnite: string;
  /** Preuves jointes à la fermeture (photos, rapport, facture). */
  preuves: Fichier[];
  /** Valeur mesurée (preuve « mesure »). */
  mesure: string;
  /** Photos du signalement. */
  photos: Fichier[];
  description: string;
  noteFin: string;
  tacheId: string | null;
  tacheStatut: string | null;
  tacheLueA: string | null;
  signalePar: Personne | null;
  creeA: string;
  creePar: string;
  termineA: string | null;
  terminePar: Personne | null;
  valideA: string | null;
  validePar: Personne | null;
  annuleA: string | null;
  annulePar: Personne | null;
  motif: string;
  /** L'équipement a été mis hors service à cause de ce problème. */
  horsService: boolean;
  /** Statut de l'équipement avant sa mise hors service (remis à la validation). */
  statutActifAvant?: string;
  /** Dernier renvoi par le responsable : une fermeture GANDALF plus ancienne ne compte plus. */
  refuseA?: string | null;
  /** Avis envoyés : étape → jour (une seule fois chacun). */
  avis: Record<string, string>;
  /** Jour du dernier avis (au plus un par tâche et par jour). */
  dernierAvis: string | null;
}

/** Réglages de l'entretien (config/entretien), tenus par les administrateurs. */
export interface ConfigEntretien {
  /** Responsable de l'entretien (D4) : valide, assigne, reçoit les retards de plus de 7 jours. */
  responsable: string;
  /** Équipe d'entretien : reçoit les problèmes signalés. */
  equipe: string[];
  /** Personne par défaut de chaque corps de métier. */
  metiers: Record<string, string>;
  /** Projet GANDALF des tâches d'entretien, et ses listes (préventifs, problèmes signalés). */
  projetGandalf: string;
  listePreventifs: string;
  listeProblemes: string;
  /** Création des tâches GANDALF (fenêtres ouvertes). */
  tachesActives: boolean;
  /** Rappels, relances, escalades et résumé du lundi. */
  avisActifs: boolean;
  listes: ListesEntretien;
}

export interface ListesEntretien {
  types: string[];
  priorites: string[];
  metiers: string[];
  criticites: string[];
  departements: string[];
}

/** Listes de choix de la maintenance, reprises de la GMAO (feuille Listes_choix). */
export const LISTES_GMAO: ListesEntretien = {
  types: [
    "Préventif (Planifié)",
    "Correctif (Bris/Panne)",
    "Amélioration / Projet",
    "Sécurité / Santé",
    "Qualité / Calibration",
    "Entretien Général",
    "Installation",
    "Mise en service",
  ],
  priorites: [
    "0 - Urgence Sécurité",
    "1 - Critique (Arrêt Prod)",
    "2 - Urgent (24h)",
    "3 - Normal (48h-72h)",
    "4 - Planifiable (Sem. proch.)",
    "5 - Faible / Esthétique",
  ],
  metiers: [
    "Resp. maintenance Chanv",
    "Électricien",
    "Plombier",
    "Frigoriste",
    "Sous-traitant",
    "Préposé Sanitaire",
    "Informatique / TI",
  ],
  criticites: ["Critique (Impact Produit)", "Majeur (Environnement)", "Mineur (Aucun Impact)", "Non-Applicable"],
  departements: ["Maintenance", "Production", "Assurance Qualité", "Logistique", "Administration", "Sécurité", "TI / Informatique"],
};

/** Délai de prise en charge d'un problème selon sa priorité, en jours (GMAO : 24 h, 48–72 h, semaine prochaine). */
export const DELAI_PRIORITE: Record<number, number> = { 0: 0, 1: 0, 2: 1, 3: 3, 4: 7, 5: 30 };

export interface FicheActif {
  actifId: string;
  photos: Fichier[];
  documents: { nom: string; url: string; source: string }[];
}

/** Ligne de la séance de reprise (lot 0, maquette V11). */
export interface LigneReprise {
  id: string;
  ordre: number;
  groupe: "regle" | "sans_tache" | "occurrences" | "rattachement";
  titre: string;
  constat: string;
  source: string;
  proposition: string;
  /** Règle proposée (groupe « regle ») : reprise telle quelle si la décision est « garder ». */
  regle: Partial<Regle> | null;
  /** Tâches GANDALF copiées d'avance, à fermer en « remplacée par la règle » (D3). */
  tachesARemplacer: { id: string; titre: string; echeance: string | null; statut: string }[];
  decision: "a_decider" | "propose" | "garder" | "fusionner" | "de_cote" | "fait";
  /** Raison d'une mise de côté, ou précision de la séance. */
  noteDecision: string;
  decidePar: string;
  decideA: string;
  importeA: string | null;
  regleCreee: string | null;
}
