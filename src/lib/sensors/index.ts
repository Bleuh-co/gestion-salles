import "server-only";

import type { ProviderSensor, SensorProvider } from "./provider";
import { tempStickProvider } from "./tempstick";

export type { ProviderSensor, SensorProvider } from "./provider";

// ============================================================
// Registre des fournisseurs de capteurs.
// Ajouter les futurs fournisseurs ici (voir provider.ts).
// ============================================================

const PROVIDERS: SensorProvider[] = [
  tempStickProvider,
  // ← futurs fournisseurs (Aranet, SensorPush, …)
];

/** Fournisseurs actuellement configurés (clé API présente, etc.). */
export function getConfiguredProviders(): SensorProvider[] {
  return PROVIDERS.filter((p) => p.isConfigured());
}

/** Au moins un fournisseur de capteurs est-il configuré ? */
export function isAnySensorProviderConfigured(): boolean {
  return getConfiguredProviders().length > 0;
}

/**
 * Liste les capteurs de tous les fournisseurs configurés (en parallèle).
 * Une panne chez un fournisseur n'affecte pas les autres.
 */
export async function listAllSensors(): Promise<ProviderSensor[]> {
  const providers = getConfiguredProviders();
  const results = await Promise.allSettled(providers.map((p) => p.listSensors()));
  const sensors: ProviderSensor[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sensors.push(...r.value);
    } else {
      console.warn(`[sensors] Provider "${providers[i].id}" failed:`, r.reason);
    }
  });
  return sensors;
}
