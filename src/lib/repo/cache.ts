import "server-only";

// ============================================================
// Petit cache mémoire TTL partagé par la couche repo.
//
// Objectif : éviter de relire Firestore à chaque requête SSR
// (les pages sont force-dynamic). Le TTL est court pour que
// les modifications apparaissent vite ; les écritures du repo
// invalident explicitement leur clé.
//
// Stocké sur globalThis pour survivre au rechargement de
// modules en dev (même pattern que firebase-admin.ts).
// ============================================================

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __gestiSalleRepoCache: Map<string, CacheEntry> | undefined;
}

function store(): Map<string, CacheEntry> {
  if (!globalThis.__gestiSalleRepoCache) {
    globalThis.__gestiSalleRepoCache = new Map();
  }
  return globalThis.__gestiSalleRepoCache;
}

const DEFAULT_TTL_MS = 30_000;

export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const s = store();
  const hit = s.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.data as T;
  const data = await loader();
  s.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

export function invalidate(key: string): void {
  store().delete(key);
}

export function invalidateAll(): void {
  store().clear();
}
