import "server-only";

// ============================================================
// Abstraction multi-fournisseurs de capteurs.
//
// Pour ajouter un nouveau fournisseur (Aranet, SensorPush, …) :
//   1. Créer src/lib/sensors/<provider>.ts qui exporte un objet
//      implémentant SensorProvider.
//   2. L'ajouter au tableau PROVIDERS de src/lib/sensors/index.ts.
// C'est tout — matching, overrides admin, fiche salle et plan
// interactif fonctionnent sur la shape normalisée ProviderSensor.
//
// ⚠️ Unicité des sensor_id : les overrides admin (collection
// sensor_overrides) sont indexés par sensor_id brut. Un nouveau
// fournisseur doit préfixer ses ids (ex. "aranet:xyz") pour
// éviter toute collision avec les ids TempStick historiques.
// ============================================================

/** Lecture de capteur normalisée, indépendante du fournisseur. */
export interface ProviderSensor {
  sensor_id: string;
  sensor_name: string | null;
  last_temp_c: number | null;
  last_humidity: number | null;
  last_checkin_utc: string | null;
  offline: boolean;
  battery: number | null;
  /** Id du fournisseur (ex. "tempstick"). */
  provider: string;
  /** Création du capteur chez le fournisseur (UTC, ex. "2026-05-26 19:03:31"). */
  created_utc?: string | null;
  /** Intervalle d'envoi des relevés, en secondes. */
  send_interval_s?: number | null;
}

/** Relevé historique normalisé : t en ms UTC. */
export interface ProviderReading {
  t: number;
  c: number | null;
  h: number | null;
}

export interface SensorProvider {
  /** Id stable du fournisseur (minuscules, sans espace). */
  id: string;
  /** Nom affiché dans l'UI. */
  label: string;
  /** Le fournisseur est-il configuré (clé API présente, etc.) ? */
  isConfigured(): boolean;
  /** Liste normalisée des capteurs (ne doit pas jeter — retourner [] en cas d'erreur). */
  listSensors(): Promise<ProviderSensor[]>;
  /**
   * Relevés d'un capteur sur des jours de Montréal (AAAA-MM-JJ, inclus).
   * Jette en cas d'erreur : la copie de nuit doit savoir qu'elle a échoué.
   */
  readings?(sensorId: string, jourDebut: string, jourFin: string): Promise<ProviderReading[]>;
}
