import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { FAMILLE_COLORS_FALLBACK, FAMILLE_SHORT } from "@/lib/types";
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
