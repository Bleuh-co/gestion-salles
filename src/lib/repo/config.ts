import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { FAMILLE_COLORS_FALLBACK, FAMILLE_SHORT } from "@/lib/types";
import type { LocalFormOptions } from "@/lib/types";
import { cached, invalidate } from "./cache";

// ============================================================
// Repo Config — remplace les lectures Google Sheet.
//
// Collection "config" :
//   - doc "familles" : { colors: { FAMILLE: "#rrggbb" }, short: { FAMILLE: "CAN" } }
//   - doc "listes"   : { vocations: [], conditions: [], niveauxAcces: [], categories_actifs: [] }
//     (valeurs des dropdowns administrables — complétées dynamiquement
//      par les valeurs déjà en usage dans les locaux/actifs)
// ============================================================

const COLLECTION = "config";
const FAMILLES_DOC = "familles";
const LISTES_DOC = "listes";
const COLORS_CACHE_KEY = "config:familleColors";
const LISTES_CACHE_KEY = "config:listes";

// ── Couleurs de familles ──

export async function getFamilleColors(): Promise<Record<string, string>> {
  return cached(COLORS_CACHE_KEY, async () => {
    try {
      const doc = await adminDb().collection(COLLECTION).doc(FAMILLES_DOC).get();
      const stored = (doc.data()?.colors ?? {}) as Record<string, string>;
      return { ...FAMILLE_COLORS_FALLBACK, ...stored };
    } catch (e) {
      console.warn("[config] getFamilleColors failed, using fallback", e);
      return { ...FAMILLE_COLORS_FALLBACK };
    }
  });
}

export async function saveFamilleColors(
  colors: Record<string, string>,
  updatedBy: string
): Promise<void> {
  await adminDb().collection(COLLECTION).doc(FAMILLES_DOC).set(
    {
      colors,
      short: FAMILLE_SHORT,
      _updated_by: updatedBy,
      _updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
  invalidate(COLORS_CACHE_KEY);
}

// ── Listes de choix (dropdowns administrables) ──

export interface ConfigListes {
  vocations: string[];
  conditions: string[];
  niveauxAcces: string[];
  categoriesActifs: string[];
  criticites: string[];
}

const EMPTY_LISTES: ConfigListes = {
  vocations: [],
  conditions: [],
  niveauxAcces: [],
  categoriesActifs: [],
  criticites: [],
};

export async function getConfigListes(): Promise<ConfigListes> {
  return cached(LISTES_CACHE_KEY, async () => {
    try {
      const doc = await adminDb().collection(COLLECTION).doc(LISTES_DOC).get();
      const data = doc.data() ?? {};
      return {
        vocations: (data.vocations as string[]) ?? [],
        conditions: (data.conditions as string[]) ?? [],
        niveauxAcces: (data.niveauxAcces as string[]) ?? [],
        categoriesActifs: (data.categoriesActifs as string[]) ?? [],
        criticites: (data.criticites as string[]) ?? [],
      };
    } catch (e) {
      console.warn("[config] getConfigListes failed", e);
      return { ...EMPTY_LISTES };
    }
  });
}

// ── Options de formulaire (dropdowns dynamiques) ──
//
// Combine les listes configurées (config/listes) avec les valeurs
// réellement en usage dans les locaux : les menus proposent donc
// toujours l'existant, et restent administrables.

export async function getLocalFormOptions(): Promise<LocalFormOptions> {
  // Import local pour éviter un cycle de modules au chargement.
  const { getLocaux } = await import("./locaux");
  const [listes, locaux] = await Promise.all([
    getConfigListes(),
    getLocaux({ includeArchived: true }),
  ]);

  const merge = (configured: string[], inUse: (string | undefined)[]) =>
    [...new Set([...configured, ...inUse.map((v) => (v || "").trim()).filter(Boolean)])].sort(
      (a, b) => a.localeCompare(b, "fr")
    );
  // Vocations/conditions peuvent être multi-valuées ("A, B") → split.
  const splitValues = (values: (string | undefined)[]) =>
    values.flatMap((v) => (v || "").split(",").map((s) => s.trim()));

  return {
    familles: merge(Object.keys(FAMILLE_SHORT), locaux.map((l) => l.famille)),
    batiments: merge([], locaux.map((l) => l.batiment)),
    etages: merge([], locaux.map((l) => l.etage)),
    vocations: merge(listes.vocations, splitValues(locaux.map((l) => l.vocation))),
    conditions: merge(listes.conditions, splitValues(locaux.map((l) => l.conditions))),
    niveauxAcces: merge(listes.niveauxAcces, locaux.map((l) => l.niveauAcces)),
  };
}

export async function saveConfigListes(
  listes: Partial<ConfigListes>,
  updatedBy: string
): Promise<void> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(listes)) {
    if (Array.isArray(v)) {
      clean[k] = [...new Set(v.map((s) => String(s).trim()).filter(Boolean))];
    }
  }
  await adminDb().collection(COLLECTION).doc(LISTES_DOC).set(
    {
      ...clean,
      _updated_by: updatedBy,
      _updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
  invalidate(LISTES_CACHE_KEY);
}
