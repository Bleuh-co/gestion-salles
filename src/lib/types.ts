// Rôle interne Gestion Salles (mappé depuis le rôle standardisé Chanv)
// - superadmin : accès total
// - admin      : gestion + voir toutes les tâches
// - membre     : voir ses propres tâches (rôle Consulter)
// - blocked    : pas d'accès
export type Role = "superadmin" | "admin" | "membre" | "blocked";

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: "Super Administrateur",
  admin: "Administrateur",
  membre: "Membre",
  blocked: "Bloqué",
};

// ============================================================
// Types métier — Gestion Salles
// ============================================================

export type RoomStatus = "normal" | "alerte" | "maintenance" | "hors_service";

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  normal: "Normal",
  alerte: "Alerte",
  maintenance: "Maintenance",
  hors_service: "Hors service",
};

export interface Usine {
  id: string;
  nom: string;
  localisation: string;
  statutGlobal: RoomStatus;
  nbSalles: number;
  salles: Salle[];
}

export interface FloorPlanRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Salle {
  id: string;
  usineId: string;
  nom: string;
  statut: RoomStatus;
  type: string; // ex: "Culture", "Séchage", "Conditionnement"
  superficie: number; // m²
  capacite: number; // nb employés max
  floorPlan: FloorPlanRect;
  capteurs: SensorReading[];
  employees: Employee[];
  devices: Device[];
  equipment: Equipment[];
  history: HistoryEvent[];
  stats: RoomStats;
}

export type SensorType = "temperature" | "humidite" | "co2" | "pression";

export interface SensorReading {
  id: string;
  type: SensorType;
  label: string;
  value: number;
  unit: string; // °C, %, ppm, hPa
  status: "ok" | "warning" | "critical";
  min: number;
  max: number;
  updatedAt: string; // ISO
}

export interface Employee {
  id: string;
  nom: string;
  prenom: string;
  poste: string;
  shift: "jour" | "soir" | "nuit";
  statut: "present" | "absent" | "pause";
  avatar?: string;
}

export type DeviceStatus = "online" | "offline" | "erreur";

export interface Device {
  id: string;
  nom: string;
  type: string; // ex: "Capteur IoT", "Contrôleur", "Caméra"
  status: DeviceStatus;
  ipAddress?: string;
  firmware?: string;
  lastSeen: string; // ISO
}

export type EquipmentStatus = "operationnel" | "maintenance" | "hors_service";

export interface Equipment {
  id: string;
  nom: string;
  categorie: string; // ex: "HVAC", "Éclairage", "Irrigation"
  modele: string;
  status: EquipmentStatus;
  dernierEntretien: string; // ISO
  prochainEntretien: string; // ISO
}

export type HistoryEventType = "info" | "alerte" | "maintenance" | "intervention";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  titre: string;
  description: string;
  auteur: string;
  timestamp: string; // ISO
}

export interface RoomStats {
  uptimePct: number;
  alertes30j: number;
  interventions30j: number;
  occupationMoyenne: number; // %
  tempMoyenne: number;
  humiditeMoyenne: number;
  trendTemp: { label: string; value: number }[];
  trendHumidite: { label: string; value: number }[];
}

export interface RoomSummary {
  id: string;
  nom: string;
  statut: RoomStatus;
  type: string;
  nbEmployes: number;
  nbDevicesOnline: number;
  nbDevicesTotal: number;
  nbAlertes: number;
  capteursCles: SensorReading[];
}
