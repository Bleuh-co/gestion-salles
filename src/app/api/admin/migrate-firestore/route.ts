import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { adminDb, getServiceAccountForGoogle } from "@/lib/firebase-admin";
import { locaux as staticLocaux, actifs as staticActifs } from "@/lib/data";
import { loadLocauxOverrides, mergeOverrides } from "@/lib/locaux-overrides";
import { invalidateLocauxCache } from "@/lib/repo/locaux";
import { invalidateActifsCache } from "@/lib/repo/actifs";
import { saveFamilleColors, saveConfigListes } from "@/lib/repo/config";
import { FAMILLE_COLORS_FALLBACK } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// ============================================================
// POST /api/admin/migrate-firestore
//
// Migration one-shot (idempotente) : promeut Firestore comme
// source de vérité unique et coupe le lien avec le Google Sheet.
//
//   1. locaux  : data.ts ⊕ locaux_overrides → collection "locaux"
//   2. actifs  : data.ts → collection "actifs"
//   3. config/familles : couleurs (best-effort import du Sheet, sinon fallback)
//   4. config/listes   : valeurs de dropdowns dérivées des données existantes
//
// Les documents déjà présents ne sont JAMAIS écrasés (safe re-run).
// Body optionnel : { "dry_run": true } pour prévisualiser.
// Réservé au superadmin.
// ============================================================

/** Best-effort : lit les couleurs de familles depuis le Sheet historique
 *  (une dernière fois, pour ne pas perdre des couleurs personnalisées).
 *  Retourne {} si le Sheet n'est pas accessible. */
async function readLegacySheetColors(): Promise<Record<string, string>> {
  try {
    const sa = getServiceAccountForGoogle();
    if (!sa) return {};
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: sa,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;
    if (!token) return {};

    const SHEET_ID = "1059QWs8VKKyF4jW0ThebEnM-qn2hMB-gpbq5gTB0Elk";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("Listes_choix")}!C1:I30?valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return {};
    const data = (await res.json()) as { values?: string[][] };
    const rows = data.values || [];
    const colors: Record<string, string> = {};
    for (let i = 1; i < rows.length; i++) {
      const famille = rows[i]?.[0];
      const couleur = rows[i]?.[6];
      if (famille && couleur && /^#[0-9a-fA-F]{6}$/.test(String(couleur).trim())) {
        colors[famille] = String(couleur).trim();
      }
    }
    return colors;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (session.role !== "superadmin") {
      return NextResponse.json(
        { error: "Réservé au super administrateur" },
        { status: 403 }
      );
    }

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = Boolean(body?.dry_run);
    } catch {
      // pas de body → migration réelle
    }

    const db = adminDb();

    // ── 1. Locaux : source statique ⊕ overrides ──
    const overrides = await loadLocauxOverrides();
    const mergedLocaux = mergeOverrides(staticLocaux, overrides);

    const locauxSnap = await db.collection("locaux").get();
    const existingLocauxIds = new Set(locauxSnap.docs.map((d) => d.id));
    const locauxToCreate = mergedLocaux.filter((l) => !existingLocauxIds.has(l.id));

    // ── 2. Actifs ──
    const actifsSnap = await db.collection("actifs").get();
    const existingActifIds = new Set(actifsSnap.docs.map((d) => d.id));
    const actifsToCreate = staticActifs.filter((a) => !existingActifIds.has(a.id));

    // ── 3. Intégrité référentielle : actifs orphelins ──
    const localIds = new Set(mergedLocaux.map((l) => l.id));
    const orphanActifs = staticActifs
      .filter((a) => a.idSalle && !localIds.has(a.idSalle))
      .map((a) => ({ id: a.id, nom: a.nom, idSalle: a.idSalle }));

    // ── 4. Config : couleurs + listes dérivées ──
    const legacyColors = await readLegacySheetColors();
    const colors = { ...FAMILLE_COLORS_FALLBACK, ...legacyColors };

    const derive = (values: (string | undefined)[]) =>
      [...new Set(values.map((v) => (v || "").trim()).filter(Boolean))].sort();
    // Les vocations/conditions sont parfois multi-valuées ("A, B") → split.
    const splitDerive = (values: (string | undefined)[]) =>
      derive(values.flatMap((v) => (v || "").split(",")));
    const listes = {
      vocations: splitDerive(mergedLocaux.map((l) => l.vocation)),
      conditions: splitDerive(mergedLocaux.map((l) => l.conditions)),
      niveauxAcces: derive(mergedLocaux.map((l) => l.niveauAcces)),
      categoriesActifs: derive(staticActifs.map((a) => a.categorie)),
      criticites: derive(staticActifs.map((a) => a.criticite)),
    };

    const report = {
      dry_run: dryRun,
      locaux: {
        total_source: mergedLocaux.length,
        deja_migres: existingLocauxIds.size,
        a_creer: locauxToCreate.length,
      },
      actifs: {
        total_source: staticActifs.length,
        deja_migres: existingActifIds.size,
        a_creer: actifsToCreate.length,
        orphelins: orphanActifs,
      },
      config: {
        couleurs_sheet_importees: Object.keys(legacyColors).length,
        listes: Object.fromEntries(
          Object.entries(listes).map(([k, v]) => [k, v.length])
        ),
      },
    };

    if (dryRun) {
      return NextResponse.json({ status: "dry_run", report });
    }

    // ── Écriture (batches de 400, limite Firestore = 500 ops) ──
    const now = new Date().toISOString();
    const meta = {
      _created_by: `migration:${session.email}`,
      _created_at: now,
      _updated_by: `migration:${session.email}`,
      _updated_at: now,
    };

    const allWrites: { col: string; id: string; data: Record<string, unknown> }[] = [
      ...locauxToCreate.map((l) => {
        const { id, ...fields } = l;
        return {
          col: "locaux",
          id,
          data: { ...fields, archived: Boolean(l.archived), ...meta },
        };
      }),
      ...actifsToCreate.map((a) => {
        const { id, ...fields } = a;
        return { col: "actifs", id, data: { ...fields, ...meta } };
      }),
    ];

    for (let i = 0; i < allWrites.length; i += 400) {
      const batch = db.batch();
      for (const w of allWrites.slice(i, i + 400)) {
        batch.set(db.collection(w.col).doc(w.id), w.data);
      }
      await batch.commit();
    }

    // Config : couleurs (merge, n'écrase pas un doc déjà personnalisé
    // car saveFamilleColors merge sur le doc) + listes seulement si absentes.
    const famillesDoc = await db.collection("config").doc("familles").get();
    if (!famillesDoc.exists || !famillesDoc.data()?.colors) {
      await saveFamilleColors(colors, `migration:${session.email}`);
    }
    const listesDoc = await db.collection("config").doc("listes").get();
    if (!listesDoc.exists) {
      await saveConfigListes(listes, `migration:${session.email}`);
    }

    invalidateLocauxCache();
    invalidateActifsCache();

    return NextResponse.json({ status: "success", report });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "UNAUTHORIZED" || message === "FORBIDDEN") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("[migrate-firestore]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
