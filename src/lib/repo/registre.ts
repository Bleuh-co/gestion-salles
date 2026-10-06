import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import type { Actif, AuditLogEntry, Local } from "@/lib/types";
import type {
  ActionEvenement,
  Changements,
  CibleEvenement,
  EvenementSalle,
} from "@/lib/registre/types";
import { lireDateInstall, sallesDesservies } from "@/lib/registre/actifs";
import { midiDe, OUVERTURE_DONNEES } from "@/lib/registre/temps";
import { nomsPersonnes } from "./personnes";

// ============================================================
// Registre par salle — registre_salles/{salleId}/evenements/{id}.
//
// Une ligne par fait qui touche la salle : fiche modifiée, actif
// entré, sorti, déplacé, retiré, plage changée, export… Un
// déplacement s'inscrit dans la salle de départ ET dans celle
// d'arrivée. Rien ne s'efface : une erreur se corrige par une
// nouvelle ligne. Le journal d'audit (audit_logs) reste tel quel ;
// chaque écriture alimente les deux.
//
// Une sous-collection par salle : les lectures par salle et par
// période n'ont besoin que des index automatiques de Firestore.
//
// Les capteurs (posé, parti), les écarts et les silences ne sont
// pas écrits ici : ils se calculent à partir des rattachements datés
// et des relevés (voir src/lib/registre/service.ts).
// ============================================================

const RACINE = "registre_salles";
const SOUS = "evenements";
const META_COL = "registre_meta";
const META_DOC = "ouverture";

export interface Auteur {
  email: string;
  nom: string;
}

export interface NouvelEvenement {
  salleId: string;
  action: ActionEvenement;
  /** Moment du fait (ISO) ; défaut : maintenant. */
  at?: string;
  jourSeulement?: boolean;
  par: Auteur;
  cible?: CibleEvenement | null;
  changes?: Changements | null;
  autreSalle?: string | null;
  motif?: string | null;
  note?: string | null;
  details?: Record<string, unknown> | null;
  source?: "app" | "reprise";
  /** Id déterministe : réécrire la même ligne ne la double pas. */
  id?: string;
}

function evenements(salleId: string) {
  return adminDb().collection(RACINE).doc(salleId).collection(SOUS);
}

function versDoc(e: NouvelEvenement, inscritA: string) {
  return {
    salleId: e.salleId,
    at: e.at ?? inscritA,
    jourSeulement: Boolean(e.jourSeulement),
    inscritA,
    action: e.action,
    par: e.par.email,
    parNom: e.par.nom,
    cible: e.cible ?? null,
    changes: e.changes && Object.keys(e.changes).length ? e.changes : null,
    autreSalle: e.autreSalle ?? null,
    motif: e.motif ?? null,
    note: e.note ?? null,
    details: e.details ?? null,
    source: e.source ?? "app",
  };
}

async function ecrire(evts: NouvelEvenement[]): Promise<void> {
  const db = adminDb();
  const inscritA = new Date().toISOString();
  for (let i = 0; i < evts.length; i += 400) {
    const batch = db.batch();
    for (const e of evts.slice(i, i + 400)) {
      const col = evenements(e.salleId);
      batch.set(e.id ? col.doc(e.id) : col.doc(), versDoc(e, inscritA));
    }
    await batch.commit();
  }
}

/** Inscrit des lignes au registre. Ne jette jamais : le registre ne bloque pas l'écriture métier. */
export async function inscrire(evts: NouvelEvenement[]): Promise<void> {
  const valides = evts.filter((e) => e.salleId && !e.salleId.includes("/"));
  if (!valides.length) return;
  try {
    await assurerOuverture();
    await ecrire(valides);
  } catch (err) {
    console.error("[registre] inscription impossible", err);
  }
}

function docVersEvenement(id: string, d: FirebaseFirestore.DocumentData): EvenementSalle {
  return {
    id,
    salleId: d.salleId ?? "",
    at: d.at ?? "",
    jourSeulement: Boolean(d.jourSeulement),
    inscritA: d.inscritA ?? d.at ?? "",
    action: d.action,
    par: d.par ?? "",
    parNom: d.parNom ?? "",
    cible: d.cible ?? null,
    changes: d.changes ?? null,
    autreSalle: d.autreSalle ?? null,
    motif: d.motif ?? null,
    note: d.note ?? null,
    details: d.details ?? null,
    source: d.source ?? "app",
  };
}

/** Lignes écrites d'une salle sur [du, au) (ISO), les plus récentes d'abord. */
export async function evenementsSalle(
  salleId: string,
  du?: string,
  au?: string
): Promise<EvenementSalle[]> {
  await assurerOuverture().catch((e) => console.error("[registre] ouverture", e));
  let q: FirebaseFirestore.Query = evenements(salleId);
  if (du) q = q.where("at", ">=", du);
  if (au) q = q.where("at", "<", au);
  const snap = await q.get();
  return snap.docs
    .map((d) => docVersEvenement(d.id, d.data()))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** Ligne d'ouverture d'une salle (état de départ). */
export async function ouvertureSalle(salleId: string): Promise<EvenementSalle | null> {
  await assurerOuverture().catch((e) => console.error("[registre] ouverture", e));
  const d = await evenements(salleId).doc("ouverture").get();
  return d.exists ? docVersEvenement(d.id, d.data()!) : null;
}

// ============================================================
// Ouverture du registre (une fois) : état de départ de chaque
// salle, reprise du journal d'audit et des dates d'installation.
// Idempotente (ids déterministes) ; un verrou évite que deux
// instances la fassent en même temps.
// ============================================================

let ouverture: Promise<void> | null = null;

/** À appeler AVANT toute écriture métier : l'état de départ doit précéder le premier mouvement. */
export function assurerOuverture(): Promise<void> {
  if (!ouverture) {
    ouverture = ouvrir().catch((e) => {
      ouverture = null;
      throw e;
    });
  }
  return ouverture;
}

async function ouvrir(): Promise<void> {
  const db = adminDb();
  const meta = db.collection(META_COL).doc(META_DOC);
  const prise = await db.runTransaction(async (tx) => {
    const m = await tx.get(meta);
    const etat = m.data()?.etat;
    if (etat === "faite") return false;
    const debut = Date.parse(m.data()?.debut ?? "");
    if (etat === "en_cours" && Date.now() - debut < 5 * 60_000) return false;
    tx.set(meta, { etat: "en_cours", debut: new Date().toISOString() }, { merge: true });
    return true;
  });
  if (!prise) return;

  const [locauxSnap, actifsSnap, auditSnap] = await Promise.all([
    db.collection("locaux").get(),
    db.collection("actifs").get(),
    db.collection("audit_logs").get(),
  ]);
  const salles = new Map(locauxSnap.docs.map((d) => [d.id, d.data()]));
  const actifs = actifsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Actif, "id">) }));
  const audits = auditSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogEntry, "id">) }));
  const noms = await nomsPersonnes([
    ...audits.map((a) => a.user),
    ...[...salles.values()].map((s) => (s._created_by as string) || ""),
  ]);
  const auteur = (email: string): Auteur => ({ email: email || "", nom: noms.get(email) || email || "" });
  const resume = (a: { id: string; matricule?: string; nom?: string }) => ({
    id: a.id,
    matricule: a.matricule ?? "",
    nom: a.nom ?? "",
  });

  const lignes: NouvelEvenement[] = [];

  // 1. État de départ : les actifs présents (et ceux qui desservent la salle).
  for (const [salleId, s] of salles) {
    const creeA = typeof s._created_at === "string" ? s._created_at : `${OUVERTURE_DONNEES}T14:31:00.000Z`;
    lignes.push({
      id: "ouverture",
      salleId,
      action: "ouverture",
      at: creeA,
      par: auteur((s._created_by as string) || ""),
      cible: { type: "local", id: salleId, nom: (s.nomSalle as string) || salleId },
      details: {
        repriseSheet: creeA.startsWith(OUVERTURE_DONNEES),
        actifs: actifs.filter((a) => a.idSalle === salleId).map(resume),
        dessert: actifs
          .filter((a) => a.idSalle !== salleId && sallesDesservies(a.locauxDesservis).includes(salleId))
          .map(resume),
      },
      source: "reprise",
    });
  }

  // 2. Reprise du journal d'audit (25 lignes au 6 octobre 2026).
  for (const a of audits) {
    let salleId: string | null = null;
    let action: ActionEvenement | null = null;
    let cible: CibleEvenement | null = null;
    if (a.target === "local") {
      salleId = a.targetId;
      cible = { type: "local", id: a.targetId, nom: a.targetName || a.targetId };
      action =
        a.action === "create"
          ? "salle_creee"
          : a.action === "update"
            ? "fiche_modifiee"
            : a.action === "restore"
              ? "salle_restauree"
              : (a.targetName || "").includes("suppression définitive")
                ? "salle_supprimee"
                : "salle_archivee";
    } else if (a.target === "actif") {
      const actif = actifs.find((x) => x.id === a.targetId);
      if (actif && salles.has(actif.idSalle)) {
        salleId = actif.idSalle;
        cible = { type: "actif", id: actif.id, nom: actif.nom || a.targetName, matricule: actif.matricule };
        action = a.action === "create" ? "actif_ajoute" : a.action === "delete" ? "actif_supprime" : "actif_modifie";
      }
    }
    if (!salleId || !action || !a.timestamp) continue;
    lignes.push({
      id: `audit_${a.id}`,
      salleId,
      action,
      at: a.timestamp,
      par: auteur(a.user),
      cible,
      changes: a.changes ?? null,
      source: "reprise",
    });
  }

  // 3. Dates d'installation connues (10 actifs sur 140 au 6 octobre 2026).
  for (const a of actifs) {
    const jour = lireDateInstall(a.dateInstall ?? "");
    if (!jour || !salles.has(a.idSalle)) continue;
    lignes.push({
      id: `install_${a.id}`,
      salleId: a.idSalle,
      action: "actif_installe",
      at: new Date(midiDe(jour)).toISOString(),
      jourSeulement: true,
      par: auteur(""),
      cible: { type: "actif", id: a.id, nom: a.nom ?? "", matricule: a.matricule ?? "" },
      source: "reprise",
    });
  }

  await ecrire(lignes);
  await meta.set(
    { etat: "faite", faiteA: new Date().toISOString(), salles: salles.size, lignes: lignes.length },
    { merge: true }
  );
  console.log(`[registre] ouverture faite : ${salles.size} salles, ${lignes.length} lignes`);
}

// ============================================================
// Inscriptions depuis les routes d'écriture
// ============================================================

export function cibleActif(a: Pick<Actif, "id" | "nom" | "matricule">): CibleEvenement {
  return { type: "actif", id: a.id, nom: a.nom || a.id, matricule: a.matricule || "" };
}

export function cibleSalle(l: Pick<Local, "id" | "nomSalle">): CibleEvenement {
  return { type: "local", id: l.id, nom: l.nomSalle || l.id };
}

/** Fiche de salle créée, modifiée, archivée, restaurée ou supprimée. */
export async function inscrireFiche(
  local: Pick<Local, "id" | "nomSalle">,
  action: ActionEvenement,
  par: Auteur,
  changes?: Changements | null
): Promise<void> {
  if (action === "fiche_modifiee" && (!changes || !Object.keys(changes).length)) return;
  await inscrire([{ salleId: local.id, action, par, cible: cibleSalle(local), changes: changes ?? null }]);
}

export interface OptionsMouvement {
  /** Moment du fait (ISO) ; défaut : maintenant. */
  at?: string;
  jourSeulement?: boolean;
  motif?: string | null;
  note?: string | null;
}

const CHAMPS_LIEU = new Set(["idSalle", "locauxDesservis"]);

/**
 * Lignes du registre pour un changement d'actif (création, modification,
 * déplacement, retrait, suppression), dans chaque salle touchée.
 * `salles` = codes de salle existants (un code inconnu = rattachement orphelin).
 */
export async function inscrireActif(
  avant: Actif | null,
  apres: Actif | null,
  par: Auteur,
  salles: Set<string>,
  changes: Changements | null,
  opts: OptionsMouvement = {}
): Promise<void> {
  const a = (apres ?? avant)!;
  const cible = cibleActif(a);
  const base = { par, cible, at: opts.at, jourSeulement: opts.jourSeulement, motif: opts.motif ?? null, note: opts.note ?? null };
  const lignes: NouvelEvenement[] = [];
  const de = avant?.idSalle ?? "";
  const vers = apres?.idSalle ?? "";
  const deSalle = salles.has(de);
  const versSalle = salles.has(vers);

  if (!avant && apres) {
    if (versSalle) lignes.push({ ...base, salleId: vers, action: "actif_ajoute" });
  } else if (avant && !apres) {
    if (deSalle) lignes.push({ ...base, salleId: de, action: "actif_supprime" });
  } else if (de !== vers) {
    const lien = `${a.id}:${Date.now()}`;
    if (deSalle && versSalle) {
      lignes.push({ ...base, salleId: de, action: "actif_sorti", autreSalle: vers, details: { lien } });
      lignes.push({ ...base, salleId: vers, action: "actif_entre", autreSalle: de, details: { lien } });
    } else if (deSalle) {
      lignes.push({ ...base, salleId: de, action: "actif_retire" });
    } else if (versSalle && de) {
      // Code de salle inconnu → salle existante : correction des données d'origine (lot 0).
      // Le fait remonte à l'ouverture du registre de la salle : l'actif y était déjà.
      const ouv = await ouvertureSalle(vers).catch(() => null);
      lignes.push({
        ...base,
        salleId: vers,
        action: "actif_corrige",
        at: opts.at ?? ouv?.at,
        jourSeulement: false,
        details: { codeInscrit: de },
      });
    } else if (versSalle) {
      lignes.push({ ...base, salleId: vers, action: "actif_ajoute" });
    }
  }

  // Autres champs modifiés : une ligne dans la salle où se trouve l'actif.
  if (avant && apres && changes) {
    const autres = Object.fromEntries(Object.entries(changes).filter(([k]) => !CHAMPS_LIEU.has(k)));
    const ou = versSalle ? vers : deSalle ? de : "";
    if (ou && Object.keys(autres).length) {
      lignes.push({ ...base, salleId: ou, action: "actif_modifie", changes: autres });
    }
  }

  // Salles desservies ajoutées / retirées.
  const avantD = new Set(sallesDesservies(avant?.locauxDesservis ?? "").filter((s) => salles.has(s)));
  const apresD = new Set(sallesDesservies(apres?.locauxDesservis ?? "").filter((s) => salles.has(s)));
  if (avant && apres) {
    for (const s of apresD) if (!avantD.has(s) && s !== vers) lignes.push({ ...base, salleId: s, action: "dessert_ajoute" });
    for (const s of avantD) if (!apresD.has(s) && s !== de) lignes.push({ ...base, salleId: s, action: "dessert_retire" });
  } else if (apres) {
    for (const s of apresD) if (s !== vers) lignes.push({ ...base, salleId: s, action: "dessert_ajoute" });
  }

  await inscrire(lignes);
}

/** Toutes les salles : lignes écrites sur [du, au) (vue Administration › Registre). */
export async function evenementsSalles(
  salleIds: string[],
  du?: string,
  au?: string
): Promise<EvenementSalle[]> {
  const res = await Promise.all(salleIds.map((id) => evenementsSalle(id, du, au).catch(() => [])));
  return res.flat().sort((a, b) => b.at.localeCompare(a.at));
}
