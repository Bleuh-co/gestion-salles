import "server-only";

import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { lirePoints, placerCapteur, type PlanCapteurs, type SuiviPlan } from "@/lib/plan-capteurs";
import { getLocaux } from "./locaux";

// ============================================================
// Le point d'un capteur sur le plan de GANDALF suit sa salle
// (règle : lib/plan-capteurs.ts). Collection `plans`, partagée avec le
// hub (routes/plan.js) : on n'y touche que sensor_positions.<capteur>,
// jamais aux autres points ni aux repères des salles.
// ============================================================

const COL = "plans";

function docVersPlan(id: string, d: FirebaseFirestore.DocumentData): PlanCapteurs {
  return {
    id,
    nom: typeof d.name === "string" && d.name ? d.name : id,
    ordre: typeof d.order === "number" ? d.order : 999,
    salles: lirePoints(d.room_positions),
    capteurs: lirePoints(d.sensor_positions),
  };
}

/** Pose le capteur sous le repère de `salleId` (null = retiré : il quitte le plan). */
export async function suivreSurLePlan(sensorId: string, salleId: string | null, par: string): Promise<SuiviPlan> {
  const locaux = await getLocaux({ includeArchived: true });
  const batiments = new Map(locaux.map((l) => [l.id, l.batiment]));
  const db = adminDb();
  return db.runTransaction<SuiviPlan>(async (tx) => {
    const snap = await tx.get(db.collection(COL));
    const plans = snap.docs.map((d) => docVersPlan(d.id, d.data()));
    const { cible, retirerDe } = placerCapteur(plans, sensorId, salleId, (id) => batiments.get(id));
    const champ = new FieldPath("sensor_positions", sensorId);
    const trace = ["positions_updated_at", FieldValue.serverTimestamp(), "positions_updated_by", par];
    for (const planId of retirerDe) tx.update(db.collection(COL).doc(planId), champ, FieldValue.delete(), ...trace);
    if (cible) {
      tx.update(db.collection(COL).doc(cible.planId), champ, cible.point, ...trace);
      return { action: "place", planId: cible.planId, planNom: plans.find((p) => p.id === cible.planId)!.nom, salleId: salleId! };
    }
    return retirerDe.length ? { action: "retire", salleId } : { action: "rien" };
  });
}
