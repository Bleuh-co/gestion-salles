import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { listAllSensors, providerOf, type ProviderSensor } from "@/lib/sensors";
import { relevesUniques, type Releve } from "@/lib/registre/mesures";
import { ajouterJours, debutJour, finJour, jourDe, joursEntre, lireHeureUtc } from "@/lib/registre/temps";

// ============================================================
// Relevés recopiés chez nous — capteur_releves/{sensorId}__{jour}.
//
// Un document par capteur et par jour de Montréal : heures (s UTC),
// températures, humidités. ~22 écritures par nuit. Un jour « complet »
// n'est jamais réécrit avec moins de relevés (si TempStick perdait
// son historique, notre copie resterait entière).
//
// La lecture prend nos copies et complète chez TempStick les jours
// pas encore copiés (dont aujourd'hui) : l'écran est toujours à jour,
// même avant la première copie de nuit. Les jours complets lus chez
// TempStick sont recopiés au passage.
// ============================================================

const COL = "capteur_releves";
const ETAT = "capteur_releves_etat";
/** Marge avant de déclarer un jour complet (relevés envoyés en retard). */
const MARGE_COMPLET = 60 * 60_000;

interface DocJour {
  sensorId: string;
  sensorName: string;
  jour: string;
  t: number[];
  c: (number | null)[];
  h: (number | null)[];
  n: number;
  complet: boolean;
  intervalleS: number | null;
  copieA: string;
}

const idDoc = (sensorId: string, jour: string) => `${sensorId}__${jour}`;

function versReleves(d: DocJour): Releve[] {
  return d.t.map((s, i) => ({ t: s * 1000, c: d.c[i] ?? null, h: d.h[i] ?? null }));
}

function versDoc(s: CapteurRef, jour: string, rs: Releve[], complet: boolean): DocJour {
  return {
    sensorId: s.sensor_id,
    sensorName: s.sensor_name || s.sensor_id,
    jour,
    t: rs.map((r) => Math.round(r.t / 1000)),
    c: rs.map((r) => r.c),
    h: rs.map((r) => r.h),
    n: rs.length,
    complet,
    intervalleS: s.send_interval_s ?? null,
    copieA: new Date().toISOString(),
  };
}

export type CapteurRef = Pick<ProviderSensor, "sensor_id" | "sensor_name"> &
  Partial<Pick<ProviderSensor, "provider" | "created_utc" | "send_interval_s">>;

function parJour(rs: Releve[]): Map<string, Releve[]> {
  const m = new Map<string, Releve[]>();
  for (const r of relevesUniques(rs)) {
    const j = jourDe(r.t);
    const l = m.get(j);
    if (l) l.push(r);
    else m.set(j, [r]);
  }
  return m;
}

async function lireDocs(sensorId: string, jours: string[]): Promise<Map<string, DocJour>> {
  const db = adminDb();
  const out = new Map<string, DocJour>();
  for (let i = 0; i < jours.length; i += 300) {
    const refs = jours.slice(i, i + 300).map((j) => db.collection(COL).doc(idDoc(sensorId, j)));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) if (s.exists) out.set((s.data() as DocJour).jour, s.data() as DocJour);
  }
  return out;
}

/** Relevés du fournisseur, par tranches de 120 jours. */
async function lireFournisseur(s: CapteurRef, du: string, au: string): Promise<Releve[]> {
  const p = providerOf(s.provider);
  if (!p?.readings) return [];
  const out: Releve[] = [];
  for (let d = du; d <= au; d = ajouterJours(d, 120)) {
    const f = ajouterJours(d, 119) < au ? ajouterJours(d, 119) : au;
    out.push(...(await p.readings(s.sensor_id, d, f)));
  }
  return out;
}

/** Écrit les jours complets (et le jour en cours) sans jamais appauvrir une copie complète. */
async function ecrireJours(
  s: CapteurRef,
  jours: string[],
  groupes: Map<string, Releve[]>,
  existants: Map<string, DocJour>,
  maintenant: number
): Promise<number> {
  const db = adminDb();
  let ecrits = 0;
  let batch = db.batch();
  let dansLot = 0;
  for (const jour of jours) {
    if (debutJour(jour) > maintenant) continue;
    const rs = (groupes.get(jour) ?? []).sort((a, b) => a.t - b.t);
    const complet = finJour(jour) + MARGE_COMPLET <= maintenant;
    const ex = existants.get(jour);
    if (ex && ex.complet && ex.n >= rs.length) continue;
    if (ex && !complet && ex.n >= rs.length) continue;
    batch.set(db.collection(COL).doc(idDoc(s.sensor_id, jour)), versDoc(s, jour, rs, complet));
    ecrits++;
    if (++dansLot === 400) {
      await batch.commit();
      batch = db.batch();
      dansLot = 0;
    }
  }
  if (dansLot) await batch.commit();
  return ecrits;
}

export interface BilanCopie {
  sensorId: string;
  nom: string;
  du: string;
  au: string;
  releves: number;
  jours: number;
  erreur?: string;
}

/** Recopie les relevés d'un capteur sur [du, au] (jours de Montréal). Idempotent. */
export async function copierCapteur(s: CapteurRef, du: string, au: string, maintenant = Date.now()): Promise<BilanCopie> {
  const bilan: BilanCopie = { sensorId: s.sensor_id, nom: s.sensor_name || s.sensor_id, du, au, releves: 0, jours: 0 };
  try {
    const rs = (await lireFournisseur(s, du, au)).filter((r) => r.t >= debutJour(du) && r.t < finJour(au));
    const jours = joursEntre(du, au);
    const existants = await lireDocs(s.sensor_id, jours);
    bilan.releves = rs.length;
    bilan.jours = await ecrireJours(s, jours, parJour(rs), existants, maintenant);
    const dernierComplet = [...jours].reverse().find((j) => finJour(j) + MARGE_COMPLET <= maintenant);
    if (dernierComplet) {
      const ref = adminDb().collection(ETAT).doc(s.sensor_id);
      const ex = (await ref.get()).data();
      if (!ex?.dernierJourComplet || ex.dernierJourComplet < dernierComplet) {
        await ref.set(
          {
            sensorName: s.sensor_name || s.sensor_id,
            dernierJourComplet: dernierComplet,
            premierJour: ex?.premierJour && ex.premierJour < du ? ex.premierJour : du,
            copieA: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    }
  } catch (e) {
    bilan.erreur = e instanceof Error ? e.message : String(e);
    console.error("[releves] copie", s.sensor_id, bilan.erreur);
  }
  return bilan;
}

/**
 * Copie de nuit (et rattrapage) : pour chaque capteur, du jour qui suit
 * la dernière copie complète (ou de la création du capteur, ou `depuis`)
 * jusqu'à aujourd'hui. Relancée, elle ne double rien.
 */
export async function copierTout(opts: { depuis?: string; sensorIds?: string[]; maintenant?: number } = {}): Promise<BilanCopie[]> {
  const maintenant = opts.maintenant ?? Date.now();
  const aujourdHui = jourDe(maintenant);
  let capteurs = await listAllSensors();
  if (opts.sensorIds?.length) capteurs = capteurs.filter((c) => opts.sensorIds!.includes(c.sensor_id));
  const etats = await adminDb().collection(ETAT).get();
  const dernier = new Map(etats.docs.map((d) => [d.id, d.data().dernierJourComplet as string | undefined]));

  const bilans: BilanCopie[] = [];
  // Trois capteurs à la fois : TempStick répond en moins d'une seconde par capteur.
  for (let i = 0; i < capteurs.length; i += 3) {
    const lot = capteurs.slice(i, i + 3).map((c) => {
      const cree = lireHeureUtc(c.created_utc ?? null);
      const suite = dernier.get(c.sensor_id);
      const du =
        opts.depuis ??
        (suite ? ajouterJours(suite, 1) : cree ? jourDe(cree) : ajouterJours(aujourdHui, -30));
      return copierCapteur(c, du <= aujourdHui ? du : aujourdHui, aujourdHui, maintenant);
    });
    bilans.push(...(await Promise.all(lot)));
  }
  return bilans;
}

/**
 * Relevés d'un capteur sur [du, au) (ms) : nos copies, complétées chez le
 * fournisseur pour les jours pas encore copiés. `incomplet` = le
 * fournisseur n'a pas répondu pour des jours qui manquent chez nous.
 */
export async function lireReleves(
  s: CapteurRef,
  du: number,
  au: number,
  maintenant = Date.now()
): Promise<{ releves: Releve[]; incomplet: boolean }> {
  const fin = Math.min(au, maintenant + 60_000);
  if (fin <= du) return { releves: [], incomplet: false };
  const jours = joursEntre(jourDe(du), jourDe(fin - 1));
  const docs = await lireDocs(s.sensor_id, jours);
  const manquants = jours.filter((j) => !docs.get(j)?.complet);
  const releves: Releve[] = [];
  for (const d of docs.values()) if (d.complet) releves.push(...versReleves(d));

  let incomplet = false;
  if (manquants.length) {
    try {
      const vivants = await lireFournisseur(s, manquants[0], manquants[manquants.length - 1]);
      const groupes = parJour(vivants);
      for (const j of manquants) releves.push(...(groupes.get(j) ?? []));
      // Recopie au passage (jours complets et jour en cours).
      ecrireJours(s, manquants, groupes, docs, maintenant).catch((e) =>
        console.warn("[releves] recopie au passage", s.sensor_id, e)
      );
    } catch (e) {
      console.warn("[releves] fournisseur indisponible", s.sensor_id, e);
      for (const j of manquants) {
        const d = docs.get(j);
        if (d) releves.push(...versReleves(d));
      }
      incomplet = true;
    }
  }
  return {
    releves: relevesUniques(releves.filter((r) => r.t >= du && r.t < au)),
    incomplet,
  };
}

/** Historique complet d'un capteur depuis sa création (proposition de date de pose). */
export async function historiqueComplet(s: CapteurRef): Promise<Releve[]> {
  const cree = lireHeureUtc(s.created_utc ?? null) ?? Date.now() - 90 * 86_400_000;
  return (await lireReleves(s, debutJour(jourDe(cree)), Date.now())).releves;
}
