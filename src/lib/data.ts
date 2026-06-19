// ============================================================
// Données mock — Gestion Salles
// Pas de Firestore. Données en mémoire pour le dev/démo.
// ============================================================

import type {
  Usine,
  Salle,
  RoomStatus,
  RoomSummary,
  SensorReading,
  Employee,
  Device,
  Equipment,
  HistoryEvent,
  RoomStats,
} from "./types";

function iso(daysAgo: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

function makeSensors(seed: number): SensorReading[] {
  const t = 20 + ((seed * 3) % 8);
  const h = 45 + ((seed * 5) % 25);
  const c = 400 + ((seed * 47) % 600);
  const p = 1010 + ((seed * 2) % 12);
  return [
    {
      id: `s${seed}-temp`,
      type: "temperature",
      label: "Température",
      value: t,
      unit: "°C",
      status: t > 26 ? "warning" : "ok",
      min: 18,
      max: 28,
      updatedAt: iso(0, 1),
    },
    {
      id: `s${seed}-hum`,
      type: "humidite",
      label: "Humidité",
      value: h,
      unit: "%",
      status: h > 65 ? "critical" : "ok",
      min: 40,
      max: 70,
      updatedAt: iso(0, 1),
    },
    {
      id: `s${seed}-co2`,
      type: "co2",
      label: "CO₂",
      value: c,
      unit: "ppm",
      status: c > 900 ? "warning" : "ok",
      min: 350,
      max: 1000,
      updatedAt: iso(0, 1),
    },
    {
      id: `s${seed}-press`,
      type: "pression",
      label: "Pression",
      value: p,
      unit: "hPa",
      status: "ok",
      min: 1000,
      max: 1025,
      updatedAt: iso(0, 1),
    },
  ];
}

function makeEmployees(seed: number): Employee[] {
  const noms = [
    ["Tremblay", "Marie", "Technicienne", "jour"],
    ["Gagnon", "Luc", "Opérateur", "soir"],
    ["Roy", "Sophie", "Superviseure", "jour"],
    ["Côté", "Marc", "Technicien", "nuit"],
    ["Bouchard", "Julie", "Agronome", "jour"],
  ];
  const n = 2 + (seed % 4);
  return noms.slice(0, n).map((e, i) => ({
    id: `emp-${seed}-${i}`,
    nom: e[0],
    prenom: e[1],
    poste: e[2],
    shift: e[3] as Employee["shift"],
    statut: (i % 3 === 0 ? "present" : i % 3 === 1 ? "pause" : "absent") as Employee["statut"],
  }));
}

function makeDevices(seed: number): Device[] {
  const types = ["Capteur IoT", "Contrôleur", "Caméra", "Passerelle"];
  const n = 2 + (seed % 3);
  return Array.from({ length: n }, (_, i) => ({
    id: `dev-${seed}-${i}`,
    nom: `${types[i % types.length]} #${seed}${i}`,
    type: types[i % types.length],
    status: (i % 4 === 3 ? "erreur" : i % 3 === 2 ? "offline" : "online") as Device["status"],
    ipAddress: `10.0.${seed}.${10 + i}`,
    firmware: `v${1 + (i % 3)}.${seed % 10}.0`,
    lastSeen: iso(0, i),
  }));
}

function makeEquipment(seed: number): Equipment[] {
  const cats = [
    ["HVAC", "Carrier 48TC"],
    ["Éclairage", "LED Fluence SPYDR"],
    ["Irrigation", "Netafim Pro"],
    ["Filtration", "AirClean X200"],
  ];
  const n = 2 + (seed % 3);
  return cats.slice(0, n).map((c, i) => ({
    id: `eq-${seed}-${i}`,
    nom: `${c[0]} - Unité ${i + 1}`,
    categorie: c[0],
    modele: c[1],
    status: (i % 3 === 1 ? "maintenance" : i % 5 === 4 ? "hors_service" : "operationnel") as Equipment["status"],
    dernierEntretien: iso(20 + i * 5),
    prochainEntretien: iso(-(30 - i * 3)),
  }));
}

function makeHistory(seed: number): HistoryEvent[] {
  const events: Array<[HistoryEvent["type"], string, string]> = [
    ["info", "Cycle démarré", "Nouveau cycle de production lancé."],
    ["alerte", "Humidité élevée", "Seuil d'humidité dépassé pendant 15 min."],
    ["maintenance", "Entretien HVAC", "Maintenance préventive du système HVAC."],
    ["intervention", "Remplacement capteur", "Capteur CO₂ remplacé suite à dérive."],
    ["info", "Inspection qualité", "Inspection de routine effectuée."],
    ["alerte", "Device hors ligne", "Une passerelle IoT a perdu la connexion."],
  ];
  const n = 4 + (seed % 4);
  return events.slice(0, Math.min(n, events.length)).map((e, i) => ({
    id: `hist-${seed}-${i}`,
    type: e[0],
    titre: e[1],
    description: e[2],
    auteur: i % 2 === 0 ? "Marie Tremblay" : "Système",
    timestamp: iso(i, i * 2),
  }));
}

function makeStats(seed: number): RoomStats {
  const labels = ["L", "M", "M", "J", "V", "S", "D"];
  return {
    uptimePct: 95 + (seed % 5),
    alertes30j: seed % 7,
    interventions30j: seed % 4,
    occupationMoyenne: 50 + ((seed * 7) % 40),
    tempMoyenne: 21 + (seed % 4),
    humiditeMoyenne: 50 + (seed % 15),
    trendTemp: labels.map((l, i) => ({ label: l, value: 20 + ((seed + i) % 6) })),
    trendHumidite: labels.map((l, i) => ({ label: l, value: 48 + ((seed + i * 2) % 18) })),
  };
}

// Plan d'étage : grille 800×500, salles non chevauchantes
const FLOOR_LAYOUTS = [
  { x: 40, y: 40, width: 220, height: 180 },
  { x: 290, y: 40, width: 220, height: 180 },
  { x: 540, y: 40, width: 220, height: 180 },
  { x: 40, y: 250, width: 170, height: 210 },
  { x: 240, y: 250, width: 170, height: 210 },
  { x: 440, y: 250, width: 150, height: 210 },
  { x: 620, y: 250, width: 140, height: 100 },
  { x: 620, y: 380, width: 140, height: 80 },
];

const SALLE_TYPES = ["Culture", "Séchage", "Conditionnement", "Extraction", "Stockage", "Laboratoire"];
const STATUTS: RoomStatus[] = ["normal", "normal", "alerte", "maintenance", "normal", "hors_service"];

function makeSalle(usineId: string, idx: number, globalSeed: number): Salle {
  const seed = globalSeed * 10 + idx;
  const statut = STATUTS[idx % STATUTS.length];
  const type = SALLE_TYPES[idx % SALLE_TYPES.length];
  return {
    id: `salle-${idx + 1}`,
    usineId,
    nom: `Salle ${type} ${idx + 1}`,
    statut,
    type,
    superficie: 40 + (seed % 60),
    capacite: 4 + (seed % 8),
    floorPlan: FLOOR_LAYOUTS[idx % FLOOR_LAYOUTS.length],
    capteurs: makeSensors(seed),
    employees: makeEmployees(seed),
    devices: makeDevices(seed),
    equipment: makeEquipment(seed),
    history: makeHistory(seed),
    stats: makeStats(seed),
  };
}

function deriveGlobalStatus(salles: Salle[]): RoomStatus {
  if (salles.some((s) => s.statut === "hors_service")) return "hors_service";
  if (salles.some((s) => s.statut === "alerte")) return "alerte";
  if (salles.some((s) => s.statut === "maintenance")) return "maintenance";
  return "normal";
}

function makeUsine(id: string, nom: string, localisation: string, nbSalles: number, seed: number): Usine {
  const salles = Array.from({ length: nbSalles }, (_, i) => makeSalle(id, i, seed));
  return {
    id,
    nom,
    localisation,
    nbSalles: salles.length,
    salles,
    statutGlobal: deriveGlobalStatus(salles),
  };
}

export const usines: Usine[] = [
  makeUsine("usine-mtl", "Usine Montréal", "1200 rue Notre-Dame, Montréal, QC", 8, 1),
  makeUsine("usine-laval", "Usine Laval", "450 boul. Industriel, Laval, QC", 6, 2),
  makeUsine("usine-tr", "Usine Trois-Rivières", "78 rue des Forges, Trois-Rivières, QC", 4, 3),
];

// ============================================================
// Helpers
// ============================================================

export function getUsines(): Usine[] {
  return usines;
}

export function getUsine(id: string): Usine | undefined {
  return usines.find((u) => u.id === id);
}

export function getSalle(usineId: string, salleId: string): Salle | undefined {
  return getUsine(usineId)?.salles.find((s) => s.id === salleId);
}

export function getRoomSummary(usineId: string, salleId: string): RoomSummary | undefined {
  const salle = getSalle(usineId, salleId);
  if (!salle) return undefined;
  return {
    id: salle.id,
    nom: salle.nom,
    statut: salle.statut,
    type: salle.type,
    nbEmployes: salle.employees.filter((e) => e.statut === "present").length,
    nbDevicesOnline: salle.devices.filter((d) => d.status === "online").length,
    nbDevicesTotal: salle.devices.length,
    nbAlertes: salle.capteurs.filter((c) => c.status !== "ok").length,
    capteursCles: salle.capteurs.slice(0, 2),
  };
}
