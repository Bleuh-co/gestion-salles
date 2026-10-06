import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import type { MatchedSensor } from "@/lib/sensor-match-core";
import { deleteOverride, loadOverridesDetail, saveOverride, saveRetrait } from "@/lib/sensor-match";
import { periodeEnCours, proposerDatePose, type Periode, type SourceRattachement } from "@/lib/registre/rattachement";
import type { Releve } from "@/lib/registre/mesures";
import { jourDe, lireHeureUtc } from "@/lib/registre/temps";
import { logAudit } from "./audit";
import { cached, invalidate } from "./cache";
import { nomsPersonnes } from "./personnes";
import type { Auteur } from "./registre";

// ============================================================
// Rattachement daté capteur → salle — collection capteur_rattachements.
//
// Une période = « ce capteur était dans cette salle du … au … ».
// Le choix manuel (sensor_overrides) reste l'état courant ; changer
// de salle ferme la période précédente et en ouvre une nouvelle, sans
// réécrire le passé. Une période « à confirmer » vient de la reprise
// (date de pose proposée d'après les mesures ou date de création du
// capteur) : une personne la valide au lot 0.
// ============================================================

const COL = "capteur_rattachements";
const CACHE = "rattachements:all";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function docVersPeriode(id: string, d: FirebaseFirestore.DocumentData): Periode {
  return {
    id,
    sensorId: d.sensorId ?? "",
    sensorName: d.sensorName ?? "",
    salleId: d.salleId ?? null,
    du: Date.parse(d.du),
    au: d.au ? Date.parse(d.au) : null,
    confirme: Boolean(d.confirme),
    source: (d.source as SourceRattachement) ?? "reprise",
    par: d.par ?? "",
    parNom: d.parNom ?? "",
    inscritA: Date.parse(d.inscritA ?? d.du),
    note: d.note ?? "",
  };
}

function periodeVersDoc(p: Omit<Periode, "id">) {
  return {
    sensorId: p.sensorId,
    sensorName: p.sensorName,
    salleId: p.salleId,
    du: iso(p.du),
    au: p.au == null ? null : iso(p.au),
    confirme: p.confirme,
    source: p.source,
    par: p.par,
    parNom: p.parNom,
    inscritA: iso(p.inscritA),
    note: p.note,
  };
}

/** Toutes les périodes (quelques dizaines de documents), avec cache court. */
export async function getPeriodes(): Promise<Periode[]> {
  return cached(CACHE, async () => {
    const snap = await adminDb().collection(COL).get();
    return snap.docs.map((d) => docVersPeriode(d.id, d.data())).filter((p) => p.sensorId && !Number.isNaN(p.du));
  });
}

export function invaliderPeriodes(): void {
  invalidate(CACHE);
}

export interface Rattachement {
  sensorId: string;
  sensorName: string;
  provider?: string;
  /** null = capteur retiré (aucune salle). */
  salleId: string | null;
  du: number;
  par: Auteur;
  note?: string;
}

/**
 * Rattache un capteur à une salle (ou le marque retiré) à partir d'un
 * instant. Le passé avant cet instant est gardé, fermé à cet instant ;
 * ce qui commençait après est remplacé. Dans la même salle, la période
 * en cours et les périodes « à confirmer » sont remplacées : la personne
 * vient de donner la vraie date de pose.
 */
export async function rattacher(r: Rattachement): Promise<{ avant: Periode[]; apres: Periode[] }> {
  const db = adminDb();
  const maintenant = Date.now();
  const res = await db.runTransaction(async (tx) => {
    const snap = await tx.get(db.collection(COL).where("sensorId", "==", r.sensorId));
    const avant = snap.docs.map((d) => docVersPeriode(d.id, d.data()));
    const apres: Periode[] = [];
    for (const d of snap.docs) {
      const p = docVersPeriode(d.id, d.data());
      // Remplacée : commence après la nouvelle date, ou c'est la période en cours
      // dans la même salle (correction de la date de pose), ou une période
      // « à confirmer » dans la même salle.
      const remplacee =
        p.du >= r.du || (p.salleId === r.salleId && (p.au == null || !p.confirme));
      if (remplacee) {
        tx.delete(d.ref);
      } else if (p.au == null || p.au > r.du) {
        tx.update(d.ref, { au: iso(r.du) });
        apres.push({ ...p, au: r.du });
      } else {
        apres.push(p);
      }
    }
    const nouvelle: Omit<Periode, "id"> = {
      sensorId: r.sensorId,
      sensorName: r.sensorName,
      salleId: r.salleId,
      du: r.du,
      au: null,
      confirme: true,
      source: "manuel",
      par: r.par.email,
      parNom: r.par.nom,
      inscritA: maintenant,
      note: r.note ?? "",
    };
    const ref = db.collection(COL).doc();
    tx.set(ref, periodeVersDoc(nouvelle));
    apres.push({ id: ref.id, ...nouvelle });
    return { avant, apres };
  });

  // État courant (utilisé par la fiche, le plan et la liste) : le choix manuel.
  if (r.salleId) await saveOverride(r.sensorId, r.salleId, r.par.email);
  else await saveRetrait(r.sensorId, r.par.email);
  invaliderPeriodes();

  const resume = (l: Periode[]) =>
    l
      .sort((a, b) => a.du - b.du)
      .map((p) => `${p.salleId ?? "—"} ${iso(p.du).slice(0, 16)}→${p.au ? iso(p.au).slice(0, 16) : "…"}${p.confirme ? "" : " (à confirmer)"}`)
      .join(" ; ");
  await logAudit({
    action: "update",
    target: "capteur",
    targetId: r.sensorId,
    targetName: r.sensorName,
    changes: { rattachement: { before: resume(res.avant), after: resume(res.apres) } },
    user: r.par.email,
  });
  return res;
}

/** Valide la date de pose proposée d'une période, sans la changer. */
export async function confirmerPeriode(id: string, par: Auteur): Promise<Periode> {
  const ref = adminDb().collection(COL).doc(id);
  const d = await ref.get();
  if (!d.exists) throw new Error("Période introuvable");
  const p = docVersPeriode(d.id, d.data()!);
  await ref.update({ confirme: true, par: par.email, parNom: par.nom, inscritA: new Date().toISOString() });
  invaliderPeriodes();
  await logAudit({
    action: "update",
    target: "capteur",
    targetId: p.sensorId,
    targetName: p.sensorName,
    changes: { "date de pose": { before: `${iso(p.du).slice(0, 16)} (à confirmer)`, after: `${iso(p.du).slice(0, 16)} (confirmée)` } },
    user: par.email,
  });
  return { ...p, confirme: true, par: par.email, parNom: par.nom };
}

/** Annule un choix manuel courant : le capteur revient au rapprochement par le nom. */
export async function oublierChoixManuel(sensorId: string): Promise<void> {
  await deleteOverride(sensorId);
}

/**
 * Met les périodes à jour d'après le rapprochement courant (nom ou choix
 * manuel) : un capteur rattaché sans période en reçoit une « à confirmer »
 * (date de pose d'après les mesures, sinon création du capteur) ; un
 * capteur dont la salle a changé hors de l'écran daté voit sa période
 * fermée maintenant et une nouvelle s'ouvrir. Sans effet sinon.
 */
export async function synchroniserPeriodes(
  capteurs: MatchedSensor[],
  historique: (s: MatchedSensor) => Promise<Releve[]>
): Promise<number> {
  const periodes = await getPeriodes();
  const aFaire = capteurs.filter((s) => {
    const ouverte = periodeEnCours(periodes, s.sensor_id);
    if (!ouverte) return Boolean(s.matched_local_id);
    return ouverte.salleId !== s.matched_local_id;
  });
  if (!aFaire.length) return 0;

  const manuels = new Map((await loadOverridesDetail()).map((o) => [o.sensor_id, o]));
  const noms = await nomsPersonnes([...manuels.values()].map((o) => o.updated_by || ""));
  const db = adminDb();
  let changes = 0;

  for (const s of aFaire) {
    const salleId = s.matched_local_id;
    const dejaEu = periodes.some((p) => p.sensorId === s.sensor_id);
    let du = Date.now();
    let source: SourceRattachement = s.match_source === "override" ? "manuel" : "nom";
    if (salleId && !dejaEu) {
      // Premier rattachement connu : quand le capteur est-il arrivé dans la salle ?
      const cree = lireHeureUtc(s.created_utc ?? null);
      let propose: number | null = null;
      try {
        propose = proposerDatePose(await historique(s), jourDe);
      } catch (e) {
        console.warn("[rattachements] historique indisponible pour", s.sensor_id, e);
      }
      du = propose ?? cree ?? du;
      source = "reprise";
    }
    const manuel = manuels.get(s.sensor_id);
    const par = manuel?.updated_by || "";

    const fait = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection(COL).where("sensorId", "==", s.sensor_id));
      const actuelles = snap.docs.map((d) => docVersPeriode(d.id, d.data()));
      const ouverte = periodeEnCours(actuelles, s.sensor_id);
      if (ouverte ? ouverte.salleId === salleId : !salleId) return false; // déjà à jour (autre instance)
      const maintenant = Date.now();
      if (ouverte) tx.update(db.collection(COL).doc(ouverte.id), { au: iso(maintenant) });
      if (salleId) {
        const debut = ouverte ? maintenant : du;
        tx.set(
          db.collection(COL).doc(`${s.sensor_id}__${debut}`),
          periodeVersDoc({
            sensorId: s.sensor_id,
            sensorName: s.sensor_name || s.sensor_id,
            salleId,
            du: debut,
            au: null,
            confirme: false,
            source,
            par,
            parNom: par ? noms.get(par) || par : "",
            inscritA: maintenant,
            note: "",
          })
        );
      }
      return true;
    });
    if (fait) changes++;
  }
  invaliderPeriodes();
  return changes;
}
