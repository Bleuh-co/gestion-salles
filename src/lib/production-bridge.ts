import "server-only";
import { adminDb } from "./firebase-admin";
import type { ProductionAssignment } from "./types";

// ============================================================
// Production-planner Bridge — Lecture seule Firestore
// Lit les collections de production-planner pour afficher
// les assignations temps réel dans gestion-salles.
// AUCUNE ÉCRITURE — lecture seule.
// ============================================================

const COLLECTIONS = {
  assignments: "production_assignments",
  families: "production_families",
  employees: "employees",
};

// ============================================================
// Cache
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL = 60_000; // 60 seconds
let _familiesCache: CacheEntry<Map<number, string>> | null = null;
let _employeesCache: CacheEntry<Map<number, string>> | null = null;

// ============================================================
// Helpers
// ============================================================

async function getProductionFamilies(): Promise<Map<number, string>> {
  if (_familiesCache && Date.now() < _familiesCache.expiresAt) {
    return _familiesCache.data;
  }
  const db = adminDb();
  const snap = await db.collection(COLLECTIONS.families).get();
  const map = new Map<number, string>();
  snap.forEach((doc) => {
    map.set(Number(doc.id), doc.data().name || `Famille ${doc.id}`);
  });
  _familiesCache = { data: map, expiresAt: Date.now() + CACHE_TTL };
  return map;
}

async function getProductionEmployees(): Promise<Map<number, string>> {
  if (_employeesCache && Date.now() < _employeesCache.expiresAt) {
    return _employeesCache.data;
  }
  const db = adminDb();
  const snap = await db.collection(COLLECTIONS.employees).get();
  const map = new Map<number, string>();
  snap.forEach((doc) => {
    const data = doc.data();
    map.set(Number(doc.id), data.basecamp_name || data.name || `Employé ${doc.id}`);
  });
  _employeesCache = { data: map, expiresAt: Date.now() + CACHE_TTL };
  return map;
}

// ============================================================
// Mapping : Production-Planner family → Locaux IDs
// This maps production-planner family names to the locaux
// from the sheet. Configurable.
// ============================================================

// Default mapping based on production-planner seed data and ChanvHQ locaux
// Key: PP family name (lowercase), Value: array of famille de salle matches
const FAMILY_TO_LOCAUX_FAMILLE: Record<string, string[]> = {
  bleuh: ["BLEUH"],
  "production psn": ["PSN"],
  "garage / maintenance": ["SERVICES TECHNIQUES"],
  culture: ["CANNABIS"],
  "transformation cannabis": ["CANNABIS"],
  expédition: ["SERVICES PRODUCTION"],
};

/**
 * Get today's assignments from production-planner, grouped by famille.
 * Returns enriched assignments with employee names and family names.
 */
export async function getTodayAssignments(): Promise<ProductionAssignment[]> {
  const db = adminDb();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const [families, employees] = await Promise.all([
    getProductionFamilies(),
    getProductionEmployees(),
  ]);

  // Get all assignments for today
  const snap = await db
    .collection(COLLECTIONS.assignments)
    .where("date", "==", today)
    .get();

  const assignments: ProductionAssignment[] = [];
  const seen = new Set<string>(); // dedupe by employee+family

  snap.forEach((doc) => {
    const data = doc.data();
    const familyId = data.family_id || null;
    const employeeId = data.employee_id;
    const key = `${employeeId}-${familyId}`;

    if (!familyId || seen.has(key)) return;
    seen.add(key);

    assignments.push({
      employeeId,
      employeeName: employees.get(employeeId) || `Employé #${employeeId}`,
      familyId,
      familyName: families.get(familyId) || `Famille #${familyId}`,
      timeSlot: data.time_slot || "pre_am",
    });
  });

  return assignments;
}

/**
 * Get count of assigned employees per local famille,
 * mapped from production-planner families.
 */
export async function getAssignmentCountsByFamille(): Promise<Record<string, number>> {
  const assignments = await getTodayAssignments();
  const counts: Record<string, number> = {};

  for (const a of assignments) {
    const ppFamName = a.familyName.toLowerCase();
    const matchedFamilles = FAMILY_TO_LOCAUX_FAMILLE[ppFamName] || [];

    for (const localFamille of matchedFamilles) {
      counts[localFamille] = (counts[localFamille] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Get assigned employees for a specific local famille.
 */
export async function getAssignmentsForFamille(
  localFamille: string
): Promise<ProductionAssignment[]> {
  const assignments = await getTodayAssignments();

  return assignments.filter((a) => {
    const ppFamName = a.familyName.toLowerCase();
    const matchedFamilles = FAMILY_TO_LOCAUX_FAMILLE[ppFamName] || [];
    return matchedFamilles.includes(localFamille);
  });
}
