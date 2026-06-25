import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-server";
import { readSheetRows } from "@/lib/sheets-sync";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/admin/sync-nomSalle
 *
 * Reads NOM SALLE (column E) from the Google Sheet and saves non-empty
 * values as Firestore overrides in the locaux_overrides collection.
 * This endpoint runs server-side where the service account credentials
 * are available.
 */
export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  try {
    // Read columns D (ID_Salle) and E (NOM SALLE) from the sheet
    const rows = await readSheetRows("Locaux_ChanvHQ", "D:E");
    if (rows.length < 2) {
      return NextResponse.json({ error: "Aucune donnée trouvée dans le sheet" }, { status: 404 });
    }

    const db = adminDb();
    const batch = db.batch();
    let count = 0;

    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const salleId = (rows[i][0] || "").trim();
      const nomSalle = (rows[i][1] || "").trim();
      if (salleId && nomSalle) {
        const ref = db.collection("locaux_overrides").doc(salleId);
        batch.set(ref, { nomSalle }, { merge: true });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      message: `${count} noms de salle importés depuis le Sheet`,
      totalRows: rows.length - 1,
      imported: count,
    });
  } catch (error) {
    console.error("[sync-nomSalle] Error:", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
