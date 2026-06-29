// ============================================================
// Types métier — Gestion Salles v2
// Source de vérité : Google Sheet ChanvHQ
// ============================================================

export type Role = "superadmin" | "admin" | "membre" | "blocked";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Administrateur",
  admin: "Administrateur",
  membre: "Membre",
  blocked: "Bloqué",
};

// ============================================================
// Locaux
// ============================================================

export type LocalStatut = "en_service" | "en_construction" | "hors_service" | "en_qualification";

export const LOCAL_STATUT_LABELS: Record<LocalStatut, string> = {
  en_service: "En Service",
  en_construction: "En Construction",
  hors_service: "Hors Service",
  en_qualification: "En Qualification",
};

export const LOCAL_STATUT_FROM_SHEET: Record<string, LocalStatut> = {
  "Validé / En Service": "en_service",
  "En Construction": "en_construction",
  "Hors Service": "hors_service",
  "En Qualification": "en_qualification",
};

export type FamilleSalle =
  | "CANNABIS"
  | "PSN"
  | "ALI"
  | "CANNABIS_R&D"
  | "BUREAUX"
  | "ZONES COMMUNES"
  | "SERVICES TECHNIQUES"
  | "SERVICES PRODUCTION"
  | "MAISON D'HERBES"
  | "BLEUH";
/** Fallback — en production, les couleurs sont lues depuis le Google Sheet (Listes_choix col I). */
export const FAMILLE_COLORS_FALLBACK: Record<string, string> = {
  CANNABIS: "#185abc",          // bleu foncé
  PSN: "#e37400",               // ambre/or foncé
  ALI: "#d81b60",               // magenta/rose
  "CANNABIS_R&D": "#1e8e3e",    // vert
  BUREAUX: "#f9ab00",           // jaune vif
  "ZONES COMMUNES": "#9aa0a6",  // gris
  "SERVICES TECHNIQUES": "#9aa0a6", // gris
  "SERVICES PRODUCTION": "#9aa0a6", // gris
  "MAISON D'HERBES": "#e8d5b7", // beige/tan
  BLEUH: "#4285f4",             // bleu (branding Bleuh)
};

/**
 * @deprecated Utiliser `familleColors` passé en props (depuis le sheet).
 * Conservé pour compatibilité — les composants qui n'ont pas encore été
 * migrés utilisent ce fallback.
 */
export const FAMILLE_COLORS: Record<string, string> = FAMILLE_COLORS_FALLBACK;

export const FAMILLE_SHORT: Record<string, string> = {
  CANNABIS: "CAN",
  PSN: "PSN",
  ALI: "ALI",
  "CANNABIS_R&D": "R&D",
  BUREAUX: "BUR",
  "ZONES COMMUNES": "ZCO",
  "SERVICES TECHNIQUES": "SET",
  "SERVICES PRODUCTION": "SEP",
  "MAISON D'HERBES": "MDH",
  BLEUH: "BLH",
};

export interface Local {
  id: string;
  nomSalle: string;
  batiment: string;
  etage: string;
  famille: string;
  idLicence: string;
  prod: boolean;
  vocation: string;
  conditions: string;
  statut: LocalStatut;
  niveauAcces: string;
  archived?: boolean;
}

// ============================================================
// Actifs (équipements)
// ============================================================

export interface Actif {
  id: string;
  matricule: string;
  idMasterlist: string;
  nom: string;
  idSalle: string;
  locauxDesservis: string;
  categorie: string;
  numeroSequence: string;
  locauxActifsDesservis: string;
  marque: string;
  modele: string;
  numSerie: string;
  photoPlaque: string;
  photoActif: string;
  parentId: string;
  criticite: string;
  dateInstall: string;
  statut: string;
}

// ============================================================
// Audit logs
// ============================================================

export type AuditAction = "create" | "update" | "delete" | "restore";
export type AuditTarget = "local" | "actif";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  target: AuditTarget;
  targetId: string;
  targetName: string;
  changes?: Record<string, { before: string; after: string }>;
  user: string;
  timestamp: string;
}

// ============================================================
// Production-planner bridge (lecture seule)
// ============================================================

export interface ProductionAssignment {
  employeeId: number;
  employeeName: string;
  familyId: number;
  familyName: string;
  timeSlot: string;
}

export interface LocalAssignationSummary {
  localId: string;
  assignments: ProductionAssignment[];
  totalEmployees: number;
}

// ============================================================
// TempStick — capteurs température / humidité
// ============================================================

export interface SensorReading {
  sensor_id: string;
  sensor_name: string | null;
  last_temp_c: number | null;
  last_humidity: number | null;
  last_checkin_utc: string | null;
  offline: boolean;
  battery: number | null;
  match_source: "auto" | "override";
}

export interface SensorMapping {
  sensor_id: string;
  sensor_name: string | null;
  matched_local_id: string | null;
  match_source: "auto" | "override" | "none";
  last_temp_c: number | null;
  last_humidity: number | null;
  offline: boolean;
  battery: number | null;
  last_checkin_utc: string | null;
}
