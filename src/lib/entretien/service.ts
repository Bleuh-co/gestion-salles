import "server-only";

import type { Actif, Local } from "@/lib/types";
import { getAllActifs, updateActif } from "@/lib/repo/actifs";
import { getLocaux } from "@/lib/repo/locaux";
import { inscrire, type NouvelEvenement } from "@/lib/repo/registre";
import { nomsPersonnes } from "@/lib/repo/personnes";
import {
  creerIntervention,
  creerOccurrence,
  getConfigEntretien,
  getIntervention,
  getInterventionsOuvertes,
  getRegle,
  getRegles,
  modifierIntervention,
  modifierRegle,
  noterAvis,
  sallesDeRegle,
  transition,
} from "@/lib/repo/entretien";
import { adminDb } from "@/lib/firebase-admin";
import type { Lang } from "@/lib/i18n-dict";
import { dateLongue } from "@/lib/registre/libelles";
import { debutJour, jourDe } from "@/lib/registre/temps";
import {
  avisDuJour,
  echeanceProbleme,
  estLundi,
  joursAvant,
  ouvertureDe,
  suivante,
  urgente,
} from "./calendrier";
import { lienApp, messageBot, notifier } from "./avis";
import { changerAssignes, changerStatut, commenter, creerTache, essayer, lireTaches, type CarteApp } from "./gandalf";
import {
  DELAI_PRIORITE,
  STATUTS_OUVERTS,
  type ConfigEntretien,
  type Fichier,
  type Intervention,
  type Personne,
  type Qui,
  type Regle,
  type StatutIntervention,
} from "./types";

// ============================================================
// La vie d'une intervention (plan, 2.5) : fenêtre ouverte → tâche
// GANDALF → terminé (à valider) avec la preuve → validée, et la
// suivante se planifie. Problèmes signalés, rappels (D2), registre.
// ============================================================

export interface Acteur extends Personne {
  uid: string;
}

export interface Contexte {
  actifs: Map<string, Actif>;
  salles: Map<string, Local>;
  config: ConfigEntretien;
}

export async function contexte(): Promise<Contexte> {
  const [actifs, locaux, config] = await Promise.all([getAllActifs(), getLocaux({ includeArchived: true }), getConfigEntretien()]);
  return {
    actifs: new Map(actifs.map((a) => [a.id, a])),
    salles: new Map(locaux.map((l) => [l.id, l])),
    config,
  };
}

const maintenant = () => new Date().toISOString();
export const aujourdHui = () => jourDe(Date.now());

function urlApp(chemin: string): string {
  return `${(process.env.NEXT_PUBLIC_APP_URL || "https://gestion-salles.chanv.com").replace(/\/+$/, "")}${chemin}`;
}

export const cheminIntervention = (id: string) => `/entretien/interventions/${encodeURIComponent(id)}`;

/** Personnes qui font le travail d'une règle : la personne, la personne par défaut du métier, ou le répondant du sous-traitant. */
export function assignesDe(qui: Qui | null, cfg: ConfigEntretien): string[] {
  if (!qui) return [];
  const e =
    qui.type === "personne" ? qui.email : qui.type === "metier" ? cfg.metiers[qui.metier] || "" : qui.repondant || "";
  return e && e.includes("@") ? [e.toLowerCase()] : [];
}

export function nomEquipements(x: Pick<Intervention, "actifIds" | "equipementLibre">, ctx: Contexte): string {
  const noms = x.actifIds.map((id) => ctx.actifs.get(id)?.nom || id).filter(Boolean);
  if (noms.length > 3) return `${noms.slice(0, 3).join(", ")} +${noms.length - 3}`;
  return noms.join(", ") || x.equipementLibre || "";
}

export function nomSalles(ids: string[], ctx: Contexte): string {
  return ids
    .map((id) => {
      const s = ctx.salles.get(id);
      return s?.nomSalle ? `${s.nomSalle} (${id})` : id;
    })
    .join(", ");
}

function titreTache(iv: Intervention, ctx: Contexte): string {
  const cible = nomEquipements(iv, ctx) || nomSalles(iv.salleIds, ctx);
  return cible ? `${iv.titre} — ${cible}` : iv.titre;
}

function carteDe(iv: Intervention, ctx: Contexte, regle: Regle | null): CarteApp {
  const salles = iv.salleIds.map((id) => ctx.salles.get(id));
  const lignes: CarteApp["lignes"] = [];
  if (iv.salleIds.length) {
    lignes.push({
      libelle: "Salle",
      valeur: salles.map((s, i) => s?.nomSalle || iv.salleIds[i]).join(", "),
      detail: iv.salleIds.join(", "),
    });
  }
  const eq = nomEquipements(iv, ctx);
  if (eq) {
    const matricules = iv.actifIds.map((id) => ctx.actifs.get(id)?.matricule).filter(Boolean).slice(0, 3).join(", ");
    lignes.push({ libelle: "Équipement", valeur: eq, detail: matricules || undefined });
  }
  if (iv.genre === "probleme") {
    lignes.push({ libelle: "Priorité", valeur: ctx.config.listes.priorites[iv.priorite ?? 3] || String(iv.priorite ?? 3) });
    if (iv.signalePar) lignes.push({ libelle: "Signalé par", valeur: iv.signalePar.nom || iv.signalePar.email });
  } else if (regle?.frequence) {
    lignes.push({ libelle: "Règle", valeur: frequenceTexteFr(regle) });
  }
  const preuve = { aucune: "", photo: "une photo", rapport: "le rapport ou la facture", mesure: `la valeur mesurée${iv.mesureUnite ? ` (${iv.mesureUnite})` : ""}` }[iv.preuveExigee];
  if (preuve) lignes.push({ libelle: "Preuve", valeur: `${preuve} exigée` });
  return {
    app: "Gestion des Salles",
    icone: "🛠️",
    titre: [salles[0]?.nomSalle || iv.salleIds[0], eq].filter(Boolean).join(" · ") || iv.titre,
    lignes: lignes.slice(0, 6),
    url: lienApp(cheminIntervention(iv.id)),
  };
}

/** Fréquence lisible en français (carte GANDALF, textes du registre écrits côté serveur). */
export function frequenceTexteFr(r: Pick<Regle, "frequence" | "calcul">): string {
  const f = r.frequence;
  if (!f) return "sans fréquence";
  let base = "";
  if (f.type === "ponctuelle") base = "une seule fois";
  else if (f.type === "saisonniere") base = `chaque année, mois ${f.mois.join(", ")}`;
  else {
    const noms = { jour: ["chaque jour", "jours"], semaine: ["chaque semaine", "semaines"], mois: ["chaque mois", "mois"], an: ["chaque année", "ans"] }[f.unite];
    base = f.n === 1 ? noms[0] : `tous les ${f.n} ${noms[1]}`;
    if (f.unite === "mois" && f.n === 6) base = "semestrielle (tous les 6 mois)";
    if (f.unite === "mois" && f.n === 3) base = "trimestrielle (tous les 3 mois)";
  }
  return `${base}, ${r.calcul === "faite" ? "depuis la date faite" : "depuis la date prévue"}`;
}

function descriptionTache(iv: Intervention, ctx: Contexte): string {
  const parties: string[] = [];
  if (iv.genre === "probleme") {
    parties.push(`Problème signalé${iv.signalePar ? ` par ${iv.signalePar.nom || iv.signalePar.email}` : ""} : ${iv.description}`);
  } else if (iv.consigne) {
    parties.push(iv.consigne);
  }
  const salles = nomSalles(iv.salleIds, ctx);
  if (salles) parties.push(`Salle : ${salles}`);
  const eq = nomEquipements(iv, ctx);
  if (eq) parties.push(`Équipement : ${eq}`);
  if (iv.preuveExigee !== "aucune") parties.push("Une preuve est demandée pour fermer : à joindre ici ou dans Gestion des Salles.");
  parties.push(`Gestion des Salles : ${urlApp(cheminIntervention(iv.id))}`);
  return parties.join("\n\n");
}

function prioriteTache(iv: Intervention): "low" | "normal" | "high" | "urgent" {
  if (iv.genre === "probleme") {
    const p = iv.priorite ?? 3;
    return p <= 1 ? "urgent" : p === 2 ? "high" : p === 3 ? "normal" : "low";
  }
  return iv.criticite.startsWith("Critique") ? "high" : "normal";
}

// ── Registre ──

function cibleDe(iv: Pick<Intervention, "actifIds">, salleId: string, ctx: Contexte) {
  const a = iv.actifIds.map((id) => ctx.actifs.get(id)).find(Boolean);
  if (a) return { type: "actif" as const, id: a.id, nom: a.nom || a.id, matricule: a.matricule || "" };
  const s = ctx.salles.get(salleId);
  return { type: "local" as const, id: salleId, nom: s?.nomSalle || salleId };
}

function detailsDe(iv: Intervention, ctx: Contexte, plus: Record<string, unknown> = {}) {
  return {
    interventionId: iv.id,
    regleId: iv.regleId,
    genre: iv.genre,
    titre: iv.titre,
    actifs: iv.actifIds.map((id) => {
      const a = ctx.actifs.get(id);
      return { id, nom: a?.nom || id, matricule: a?.matricule || "" };
    }),
    equipementLibre: iv.equipementLibre || null,
    echeance: iv.echeance,
    priorite: iv.priorite,
    ...plus,
  };
}

async function inscrireIntervention(
  iv: Intervention,
  action: NouvelEvenement["action"],
  par: Personne,
  ctx: Contexte,
  opts: { at?: string; motif?: string | null; note?: string | null; details?: Record<string, unknown> } = {}
) {
  await inscrire(
    iv.salleIds
      .filter((s) => ctx.salles.has(s))
      .map((salleId) => ({
        // Id déterministe : rejouer la même inscription (même geste, même instant) ne la double pas.
        id: `${action}_${iv.id}_${(opts.at || "").replace(/[^0-9]/g, "") || Date.now()}`,
        salleId,
        action,
        at: opts.at,
        par,
        cible: cibleDe(iv, salleId, ctx),
        motif: opts.motif ?? null,
        note: opts.note ?? null,
        details: detailsDe(iv, ctx, opts.details),
      }))
  );
}

/** Lignes « entretien ajouté / modifié / retiré » dans chaque salle de la règle. */
export async function inscrireRegle(
  r: Regle,
  action: "entretien_ajoute" | "entretien_modifie" | "entretien_retire",
  par: Personne,
  ctx: Contexte,
  changes?: Record<string, { before: string; after: string }> | null
) {
  const salles = sallesDeRegle(r, ctx.actifs).filter((s) => ctx.salles.has(s));
  await inscrire(
    salles.map((salleId) => ({
      salleId,
      action,
      par,
      cible: cibleDe({ actifIds: r.actifIds }, salleId, ctx),
      changes: changes ?? null,
      details: {
        regleId: r.id,
        titre: r.titre,
        frequence: frequenceTexteFr(r),
        prochaine: r.prochaine,
        actifs: r.actifIds.map((id) => ({ id, nom: ctx.actifs.get(id)?.nom || id, matricule: ctx.actifs.get(id)?.matricule || "" })),
        origine: r.origine?.source ?? "app",
      },
    }))
  );
}

// ── Occurrences et tâches ──

function interventionDeRegle(r: Regle, echeance: string, ctx: Contexte): Omit<Intervention, "id"> {
  const assignes = assignesDe(r.qui, ctx.config);
  return {
    genre: "preventif",
    regleId: r.id,
    titre: r.titre,
    consigne: r.consigne,
    type: r.type,
    actifIds: r.actifIds,
    salleIds: sallesDeRegle(r, ctx.actifs),
    equipementLibre: r.equipementLibre,
    echeance,
    ouverture: ouvertureDe(echeance, r),
    priorite: null,
    criticite: r.criticite,
    statut: "a_assigner",
    assignes,
    checklist: r.checklist.map((texte) => ({ texte, fait: false })),
    preuveExigee: r.preuve,
    mesureUnite: r.mesureUnite,
    preuves: [],
    mesure: "",
    photos: [],
    description: "",
    noteFin: "",
    tacheId: null,
    tacheStatut: null,
    tacheLueA: null,
    signalePar: null,
    creeA: maintenant(),
    creePar: "gestion-salles",
    termineA: null,
    terminePar: null,
    valideA: null,
    validePar: null,
    annuleA: null,
    annulePar: null,
    motif: "",
    horsService: false,
    avis: {},
    dernierAvis: null,
  };
}

/**
 * Crée la tâche GANDALF d'une intervention qui a quelqu'un : elle passe « à faire ».
 * GANDALF prévient la personne : c'est l'avis du jour (au plus un par jour).
 */
export async function creerTacheIntervention(iv: Intervention, ctx: Contexte): Promise<Intervention> {
  if (iv.tacheId || !iv.assignes.length) return iv;
  const regle = iv.regleId ? await getRegle(iv.regleId) : null;
  const preventif = iv.genre === "preventif";
  const id = await creerTache({
    externalKey: iv.id,
    titre: titreTache(iv, ctx),
    description: descriptionTache(iv, ctx),
    echeance: iv.echeance,
    assignes: iv.assignes,
    projetId: ctx.config.projetGandalf,
    listeId: (preventif ? ctx.config.listePreventifs : ctx.config.listeProblemes) || null,
    priorite: prioriteTache(iv),
    sousTaches: iv.checklist.map((c) => c.texte),
    carte: carteDe(iv, ctx, regle),
    notifTitre: preventif ? "🛠️ Entretien à faire" : "⚠️ Problème à régler",
  });
  const patch = {
    tacheId: id,
    tacheStatut: "open",
    tacheLueA: maintenant(),
    statut: (iv.statut === "a_assigner" ? "a_faire" : iv.statut) as StatutIntervention,
    dernierAvis: aujourdHui(),
  };
  await modifierIntervention(iv.id, patch);
  return { ...iv, ...patch };
}

export interface BilanFenetres {
  ouvertes: number;
  taches: number;
  sansPersonne: number;
  erreurs: string[];
}

/**
 * Ouvre les fenêtres du jour : une occurrence par règle active dont la fenêtre
 * est ouverte, et sa tâche. Appelée en semaine seulement (GANDALF préviendrait
 * la personne un samedi) : une fenêtre ouverte la fin de semaine l'est le lundi.
 */
export async function ouvrirFenetres(jour: string, ctx: Contexte): Promise<BilanFenetres> {
  const bilan: BilanFenetres = { ouvertes: 0, taches: 0, sansPersonne: 0, erreurs: [] };
  const tentees = new Set<string>();
  const regles = (await getRegles()).filter((r) => r.etat === "active" && r.prochaine && r.frequence);
  for (const r of regles) {
    if (ouvertureDe(r.prochaine!, r) > jour) continue;
    try {
      const iv = await creerOccurrence(interventionDeRegle(r, r.prochaine!, ctx));
      if (!iv) continue;
      tentees.add(iv.id);
      bilan.ouvertes++;
      if (!iv.assignes.length) bilan.sansPersonne++;
      else {
        await creerTacheIntervention(iv, ctx);
        bilan.taches++;
      }
    } catch (e) {
      bilan.erreurs.push(`${r.titre} : ${e instanceof Error ? e.message : e}`);
    }
  }
  // Tâches qui n'ont pas pu être créées (GANDALF injoignable, levier pas encore posé) : on réessaie.
  for (const iv of await getInterventionsOuvertes()) {
    if (iv.tacheId || !iv.assignes.length || iv.statut === "a_valider" || tentees.has(iv.id)) continue;
    try {
      await creerTacheIntervention(iv, ctx);
      bilan.taches++;
    } catch (e) {
      bilan.erreurs.push(`${iv.titre} : ${e instanceof Error ? e.message : e}`);
    }
  }
  return bilan;
}

// ── Relecture des tâches GANDALF ──

/**
 * Relit l'état des tâches GANDALF d'interventions ouvertes et l'applique :
 * fermée dans GANDALF → « à valider » ; rouverte → « en cours » ; liste de
 * contrôle et pièces jointes reprises. N'écrit que ce qui change.
 */
export async function relireTaches(ivs: Intervention[], ctx: Contexte): Promise<Intervention[]> {
  const suivies = ivs.filter((iv) => iv.tacheId && ["a_faire", "en_cours", "en_attente", "a_valider"].includes(iv.statut));
  if (!suivies.length) return ivs;
  const etats = await lireTaches(suivies.map((iv) => iv.tacheId!));
  const maj = new Map<string, Intervention>();
  const fermeesDansGandalf: Intervention[] = [];
  for (const iv of suivies) {
    const e = etats.get(iv.tacheId!);
    if (!e) continue;
    const patch: Partial<Intervention> = {};
    if (!e.existe || e.archivee) {
      if (iv.tacheStatut !== "archivee") patch.tacheStatut = "archivee";
    } else {
      if (e.statut !== iv.tacheStatut) patch.tacheStatut = e.statut;
      const checklist = iv.checklist.map((c) => ({ ...c, fait: c.fait || e.sousTachesFaites.includes(c.texte) }));
      if (checklist.some((c, i) => c.fait !== iv.checklist[i].fait)) patch.checklist = checklist;
      const connues = new Set(iv.preuves.map((p) => p.url).filter(Boolean));
      const jointes: Fichier[] = e.piecesJointes
        .filter((p) => !connues.has(p.url))
        .map((p) => ({ url: p.url, nom: p.nom, type: p.type, par: "", parNom: "GANDALF", a: maintenant() }));
      if (jointes.length) patch.preuves = [...iv.preuves, ...jointes];
      // Une fermeture antérieure au dernier renvoi (GANDALF n'a pas pu rouvrir la tâche) ne compte pas.
      const fermetureNeuve = !iv.refuseA || (e.fermeeA ?? "") > iv.refuseA;
      if (e.fermee && fermetureNeuve && ["a_faire", "en_cours", "en_attente"].includes(iv.statut)) {
        const noms = await nomsPersonnes([e.fermeePar || ""]);
        patch.statut = "a_valider";
        patch.termineA = e.fermeeA || maintenant();
        patch.terminePar = e.fermeePar ? { email: e.fermeePar, nom: noms.get(e.fermeePar) || e.fermeePar } : null;
      } else if (!e.fermee && iv.statut === "a_valider" && iv.tacheStatut === "done") {
        // Rouverte dans GANDALF après avoir été fermée : le travail reprend.
        patch.statut = "en_cours";
        patch.termineA = null;
        patch.terminePar = null;
      } else if (e.statut === "in_progress" && iv.statut === "a_faire") {
        patch.statut = "en_cours";
      }
    }
    if (!Object.keys(patch).length) continue;
    patch.tacheLueA = maintenant();
    if (patch.statut) {
      const ok = await transition(iv.id, [iv.statut], patch);
      if (!ok) continue;
      const apres = { ...iv, ...patch } as Intervention;
      maj.set(iv.id, apres);
      if (patch.statut === "a_valider") fermeesDansGandalf.push(apres);
    } else {
      await modifierIntervention(iv.id, patch);
      maj.set(iv.id, { ...iv, ...patch } as Intervention);
    }
  }
  for (const iv of fermeesDansGandalf) {
    await apresTermine(iv, ctx, iv.terminePar ?? { email: "", nom: "GANDALF" }, "gandalf");
  }
  return ivs.map((iv) => maj.get(iv.id) ?? iv);
}

// ── Gestes ──

export class ErreurEntretien extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "ErreurEntretien";
  }
}

export interface Signalement {
  salleId: string;
  actifIds: string[];
  description: string;
  priorite: number;
  photos: Fichier[];
  horsService: boolean;
  /** Gestionnaire qui assigne tout de suite (facultatif). */
  assigner?: string[];
}

/** Problème signalé (fiche de la salle ou téléphone après le code QR). */
export async function signalerProbleme(s: Signalement, par: Acteur): Promise<Intervention> {
  const ctx = await contexte();
  if (!ctx.salles.has(s.salleId)) throw new ErreurEntretien("Salle inconnue", 404);
  const jour = aujourdHui();
  const priorite = Math.min(5, Math.max(0, Math.round(s.priorite)));
  const actifs = s.actifIds.filter((id) => ctx.actifs.has(id));
  const salleIds = [...new Set([s.salleId, ...actifs.map((id) => ctx.actifs.get(id)!.idSalle).filter((x) => ctx.salles.has(x))])];
  const premier = actifs.map((id) => ctx.actifs.get(id)!)[0];
  const iv = await creerIntervention({
    genre: "probleme",
    regleId: null,
    titre: s.description.split(/[.\n]/)[0].slice(0, 90) || "Problème signalé",
    consigne: "",
    type: "Correctif (Bris/Panne)",
    actifIds: actifs,
    salleIds,
    equipementLibre: "",
    echeance: echeanceProbleme(priorite, jour, DELAI_PRIORITE),
    ouverture: jour,
    priorite,
    criticite: premier?.criticite || "",
    statut: "a_assigner",
    assignes: [],
    checklist: [],
    preuveExigee: "photo",
    mesureUnite: "",
    preuves: [],
    mesure: "",
    photos: s.photos,
    description: s.description,
    noteFin: "",
    tacheId: null,
    tacheStatut: null,
    tacheLueA: null,
    signalePar: { email: par.email, nom: par.nom },
    creeA: maintenant(),
    creePar: par.email,
    termineA: null,
    terminePar: null,
    valideA: null,
    validePar: null,
    annuleA: null,
    annulePar: null,
    motif: "",
    horsService: s.horsService && !!premier,
    avis: {},
    dernierAvis: null,
  });
  await inscrireIntervention(iv, "probleme_signale", par, ctx, {
    at: iv.creeA,
    note: s.description,
    details: { photos: s.photos.length, horsService: iv.horsService },
  });
  if (iv.horsService && premier) await mettreHorsService(premier, iv, par, ctx);

  // L'équipe d'entretien (sinon le responsable) est prévenue ; message du bot pour une priorité 0 ou 1.
  const equipe = ctx.config.equipe.length ? ctx.config.equipe : ctx.config.responsable ? [ctx.config.responsable] : [];
  const lieu = [ctx.salles.get(s.salleId)?.nomSalle || s.salleId, premier?.nom].filter(Boolean).join(", ");
  const texte = {
    titre: "avis.probleme.titre",
    corps: "avis.probleme.corps",
    vars: (l: Lang) => ({ lieu, description: s.description.slice(0, 200), priorite: libellePriorite(priorite, l) }),
  };
  for (const email of equipe) {
    if (email === par.email) continue;
    if (urgente(iv)) await messageBot(email, `probleme-${iv.id}`, texte, cheminIntervention(iv.id));
    else await notifier(email, texte, cheminIntervention(iv.id));
  }
  if (s.assigner?.length) return assigner(iv.id, s.assigner, par);
  return iv;
}

function libellePriorite(p: number, l: Lang): string {
  const n = { fr: ["Urgence sécurité", "Critique (arrêt de production)", "Urgent (24 h)", "Normal (48 à 72 h)", "Planifiable", "Faible"], en: ["Safety emergency", "Critical (production stopped)", "Urgent (24 h)", "Normal (48–72 h)", "Can be planned", "Low"], es: ["Emergencia de seguridad", "Crítica (producción detenida)", "Urgente (24 h)", "Normal (48 a 72 h)", "Planificable", "Baja"] }[l];
  return `${p} – ${n[p] ?? ""}`;
}

async function mettreHorsService(a: Actif, iv: Intervention, par: Personne, ctx: Contexte) {
  if (a.statut === "Hors Service") return;
  await updateActif(a.id, { statut: "Hors Service" }, par.email);
  await modifierIntervention(iv.id, { statutActifAvant: a.statut });
  await inscrireIntervention(iv, "actif_hors_service", par, ctx, { details: { statutAvant: a.statut } });
}

/** Assigne (ou réassigne) l'intervention et crée sa tâche GANDALF si elle n'en a pas. */
export async function assigner(id: string, emails: string[], par: Acteur): Promise<Intervention> {
  const ctx = await contexte();
  const iv = await getIntervention(id);
  if (!iv) throw new ErreurEntretien("Intervention introuvable", 404);
  if (!STATUTS_OUVERTS.includes(iv.statut)) throw new ErreurEntretien("Cette intervention n'est plus ouverte.", 409);
  const assignes = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")))];
  if (!assignes.length) throw new ErreurEntretien("Choisir au moins une personne.");
  if (iv.tacheId) {
    // Tâche déjà créée : la réassignation passe par GANDALF, au nom de la personne.
    const tacheId = iv.tacheId;
    const erreur = await essayer(() => changerAssignes(par, tacheId, assignes));
    if (erreur) throw new ErreurEntretien(`GANDALF n'a pas changé la personne : ${erreur}`, 502);
    await modifierIntervention(id, { assignes });
    return { ...iv, assignes };
  }
  await modifierIntervention(id, { assignes });
  return creerTacheIntervention({ ...iv, assignes }, ctx);
}

export interface Fin {
  checklist?: boolean[];
  preuves?: Fichier[];
  mesure?: string;
  note?: string;
}

/** Ce qui manque pour fermer : rien si la preuve exigée est là. */
export function preuveManquante(iv: Pick<Intervention, "preuveExigee" | "preuves" | "mesure">): boolean {
  if (iv.preuveExigee === "aucune") return false;
  if (iv.preuveExigee === "mesure") return !iv.mesure.trim();
  if (iv.preuveExigee === "photo") return !iv.preuves.some((p) => p.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(p.nom));
  return iv.preuves.length === 0;
}

/** L'intervenant met « Terminé (à valider) », avec la preuve demandée. */
export async function terminer(id: string, fin: Fin, par: Acteur): Promise<Intervention> {
  const ctx = await contexte();
  const iv = await getIntervention(id);
  if (!iv) throw new ErreurEntretien("Intervention introuvable", 404);
  if (!["a_faire", "en_cours", "en_attente"].includes(iv.statut)) throw new ErreurEntretien("Cette intervention n'est pas à faire.", 409);
  if (iv.genre === "preventif" && iv.ouverture && iv.ouverture > aujourdHui()) {
    throw new ErreurEntretien("La fenêtre de cet entretien n'est pas encore ouverte.", 409);
  }
  const checklist = iv.checklist.map((c, i) => ({ ...c, fait: fin.checklist?.[i] ?? c.fait }));
  const preuves = [...iv.preuves, ...(fin.preuves ?? [])];
  const mesure = (fin.mesure ?? iv.mesure ?? "").trim().slice(0, 60);
  if (preuveManquante({ preuveExigee: iv.preuveExigee, preuves, mesure })) {
    throw new ErreurEntretien("La preuve demandée manque.", 422);
  }
  const patch: Partial<Intervention> = {
    statut: "a_valider",
    checklist,
    preuves,
    mesure,
    noteFin: (fin.note ?? "").trim().slice(0, 1000),
    termineA: maintenant(),
    terminePar: { email: par.email, nom: par.nom },
  };
  const apres = await transition(id, ["a_faire", "en_cours", "en_attente"], patch);
  if (!apres) throw new ErreurEntretien("Quelqu'un vient de changer cette intervention : recharger.", 409);
  if (apres.tacheId) {
    // La tâche GANDALF suit, au nom de l'intervenant (si GANDALF refuse, l'app reste juste).
    const erreur = await essayer(() => changerStatut(par, apres.tacheId!, true));
    if (!erreur) await modifierIntervention(id, { tacheStatut: "done" });
  }
  await apresTermine(apres, ctx, par, "app");
  return apres;
}

async function apresTermine(iv: Intervention, ctx: Contexte, par: Personne, via: "app" | "gandalf") {
  const faits = iv.checklist.filter((c) => c.fait).length;
  await inscrireIntervention(iv, "entretien_fait", par, ctx, {
    at: iv.termineA ?? undefined,
    note: iv.noteFin || null,
    details: {
      via,
      preuves: iv.preuves.map((p) => ({ nom: p.nom, chemin: p.chemin ?? null, url: p.url ?? null })),
      mesure: iv.mesure ? `${iv.mesure}${iv.mesureUnite ? ` ${iv.mesureUnite}` : ""}` : null,
      checklist: iv.checklist.length ? `${faits}/${iv.checklist.length}` : null,
      preuveManquante: preuveManquante(iv),
    },
  });
  const resp = ctx.config.responsable;
  if (resp && resp !== par.email) {
    await notifier(
      resp,
      {
        titre: "avis.aValider.titre",
        corps: "avis.aValider.corps",
        vars: { titre: titreTache(iv, ctx), preuves: iv.preuves.length, qui: par.nom || par.email },
      },
      cheminIntervention(iv.id)
    );
  }
}

/** Le responsable valide : ligne au registre, la suivante se planifie, « C'est réglé » à qui a signalé. */
export async function valider(id: string, par: Acteur, remettreEnService = true): Promise<Intervention> {
  const ctx = await contexte();
  const avant = await getIntervention(id);
  if (!avant) throw new ErreurEntretien("Intervention introuvable", 404);
  const iv = await transition(id, ["a_valider"], { statut: "validee", valideA: maintenant(), validePar: { email: par.email, nom: par.nom } });
  if (!iv) throw new ErreurEntretien("Cette intervention n'est pas à valider.", 409);

  let prochaine: string | null = null;
  if (iv.regleId) {
    const r = await getRegle(iv.regleId);
    if (r && iv.echeance) {
      prochaine = suivante(r, iv.echeance, jourDe(Date.parse(iv.termineA || iv.valideA!)));
      await modifierRegle(r.id, { prochaine }, par.email);
    }
  }
  await inscrireIntervention(iv, "intervention_validee", par, ctx, { at: iv.valideA!, details: { prochaine } });

  const statutAvant = avant.statutActifAvant;
  if (iv.horsService && remettreEnService) {
    const a = iv.actifIds.map((x) => ctx.actifs.get(x)).find(Boolean);
    if (a && a.statut === "Hors Service") {
      await updateActif(a.id, { statut: statutAvant || "Validé / En Service" }, par.email);
      await inscrireIntervention(iv, "actif_remis_en_service", par, ctx, { details: { statut: statutAvant || "Validé / En Service" } });
    }
  }
  if (iv.genre === "probleme" && iv.signalePar?.email && iv.signalePar.email !== par.email) {
    const lieu = [nomSalles(iv.salleIds.slice(0, 1), ctx), nomEquipements(iv, ctx)].filter(Boolean).join(", ");
    await messageBot(
      iv.signalePar.email,
      `regle-${iv.id}`,
      { titre: "avis.regle.titre", corps: "avis.regle.corps", vars: { description: iv.description.slice(0, 200), lieu } },
      cheminIntervention(iv.id)
    );
  }
  return iv;
}

/** Le responsable renvoie le travail : retour « en cours », tâche GANDALF rouverte, l'intervenant est prévenu. */
export async function refuser(id: string, motif: string, par: Acteur): Promise<Intervention> {
  const ctx = await contexte();
  const m = motif.trim().slice(0, 500);
  if (!m) throw new ErreurEntretien("Dire ce qui manque.");
  const iv = await transition(id, ["a_valider"], { statut: "en_cours", termineA: null, terminePar: null, refuseA: maintenant() });
  if (!iv) throw new ErreurEntretien("Cette intervention n'est pas à valider.", 409);
  if (iv.tacheId) {
    const tacheId = iv.tacheId;
    const erreur = await essayer(async () => {
      await changerStatut(par, tacheId, false);
      await commenter(par, tacheId, `À reprendre : ${m}`);
    });
    if (!erreur) await modifierIntervention(id, { tacheStatut: "open" });
  }
  await inscrireIntervention(iv, "intervention_refusee", par, ctx, { motif: m });
  for (const email of iv.assignes) {
    if (email === par.email) continue;
    await notifier(email, { titre: "avis.refus.titre", corps: "avis.refus.corps", vars: { titre: titreTache(iv, ctx), motif: m } }, cheminIntervention(iv.id));
  }
  return iv;
}

/** Annule une intervention ouverte, avec un motif ; une préventive passe à l'échéance suivante. */
export async function annuler(id: string, motif: string, par: Acteur): Promise<Intervention> {
  const ctx = await contexte();
  const m = motif.trim().slice(0, 500);
  if (!m) throw new ErreurEntretien("Le motif est obligatoire.");
  const iv = await transition(id, ["a_assigner", "a_faire", "en_cours", "en_attente", "a_valider"], {
    statut: "annulee",
    annuleA: maintenant(),
    annulePar: { email: par.email, nom: par.nom },
    motif: m,
  });
  if (!iv) throw new ErreurEntretien("Cette intervention est déjà fermée.", 409);
  if (iv.tacheId) {
    const tacheId = iv.tacheId;
    await essayer(async () => {
      await commenter(par, tacheId, `Annulée dans Gestion des Salles : ${m}`);
      await changerStatut(par, tacheId, true);
    });
  }
  let prochaine: string | null = null;
  if (iv.regleId && iv.echeance) {
    const r = await getRegle(iv.regleId);
    if (r && r.etat === "active") {
      prochaine = suivante(r, iv.echeance, iv.echeance);
      await modifierRegle(r.id, { prochaine }, par.email);
    }
  }
  await inscrireIntervention(iv, "intervention_annulee", par, ctx, { at: iv.annuleA!, motif: m, details: { prochaine } });
  return iv;
}

/** En cours / en attente (pièces, approbation) : statut de l'app, la tâche GANDALF suit si elle peut. */
export async function changerAvancement(id: string, statut: "en_cours" | "en_attente", note: string, par: Acteur): Promise<Intervention> {
  const iv = await transition(id, statut === "en_cours" ? ["a_faire", "en_attente"] : ["a_faire", "en_cours"], {
    statut,
    ...(statut === "en_attente" ? { motif: note.trim().slice(0, 300) } : {}),
  });
  if (!iv) throw new ErreurEntretien("Cette intervention a changé : recharger.", 409);
  if (iv.tacheId && note.trim()) {
    const tacheId = iv.tacheId;
    await essayer(() => commenter(par, tacheId, statut === "en_attente" ? `En attente : ${note.trim()}` : note.trim()));
  }
  return iv;
}

export async function cocher(id: string, index: number, fait: boolean): Promise<Intervention> {
  const iv = await getIntervention(id);
  if (!iv) throw new ErreurEntretien("Intervention introuvable", 404);
  if (!STATUTS_OUVERTS.includes(iv.statut) || !iv.checklist[index]) throw new ErreurEntretien("Étape introuvable", 404);
  const checklist = iv.checklist.map((c, i) => (i === index ? { ...c, fait } : c));
  await modifierIntervention(id, { checklist });
  return { ...iv, checklist };
}

// ── Avis du jour (lot 3) ──

export interface BilanAvis {
  rappels: number;
  relances: number;
  escalades: number;
  resumes: number;
  finDeSemaine: boolean;
}

async function uneFois(cle: string): Promise<boolean> {
  try {
    await adminDb().collection("entretien_meta").doc(cle).create({ a: maintenant() });
    return true;
  } catch {
    return false;
  }
}

export async function envoyerAvisDuJour(jour: string, ctx: Contexte): Promise<BilanAvis> {
  const bilan: BilanAvis = { rappels: 0, relances: 0, escalades: 0, resumes: 0, finDeSemaine: false };
  const ouvertes = await getInterventionsOuvertes();
  const escalades: Intervention[] = [];
  for (const iv of ouvertes) {
    const etape = avisDuJour(iv, jour);
    if (!etape) continue;
    const lieu = [nomSalles(iv.salleIds.slice(0, 1), ctx), nomEquipements(iv, ctx)].filter(Boolean).join(", ");
    const vars = (l: Lang) => ({
      titre: iv.titre,
      lieu,
      date: iv.echeance ? dateLongue(debutJour(iv.echeance) + 12 * 3600_000, { fr: "fr-CA", en: "en-CA", es: "es" }[l]) : "",
    });
    if (etape === "escalade") {
      if (!ctx.config.responsable) continue;
      escalades.push(iv);
      await noterAvis(iv.id, "escalade", jour);
      continue;
    }
    const texte = { titre: `avis.${etape}.titre`, corps: `avis.${etape}.corps`, vars };
    for (const email of iv.assignes) {
      if (etape === "j1") await messageBot(email, `relance-${iv.id}-${jour}`, texte, cheminIntervention(iv.id));
      else await notifier(email, texte, cheminIntervention(iv.id));
    }
    await noterAvis(iv.id, etape, jour);
    if (etape === "j1") bilan.relances++;
    else bilan.rappels++;
  }
  if (escalades.length && ctx.config.responsable) {
    const liste = escalades
      .slice(0, 8)
      .map((iv) => `${iv.titre} (${[nomEquipements(iv, ctx) || nomSalles(iv.salleIds.slice(0, 1), ctx)].filter(Boolean).join("")}, ${-joursAvant(iv.echeance!, jour)} j)`)
      .join(" ; ");
    await messageBot(
      ctx.config.responsable,
      `escalade-${jour}`,
      { titre: "avis.escalade.titre", corps: "avis.escalade.corps", vars: { n: escalades.length, liste: escalades.length > 8 ? `${liste} …` : liste } },
      "/entretien?vue=interventions&filtre=retard"
    );
    bilan.escalades = escalades.length;
  }

  // Résumé du lundi, 7 h : une seule notification par personne qui a de l'entretien.
  if (estLundi(jour) && (await uneFois(`resume-${jour}`))) {
    const parPersonne = new Map<string, { n: number; retard: number }>();
    for (const iv of ouvertes) {
      if (!["a_faire", "en_cours", "en_attente"].includes(iv.statut)) continue;
      const retard = iv.echeance ? joursAvant(iv.echeance, jour) < 0 : false;
      for (const e of iv.assignes) {
        const x = parPersonne.get(e) ?? { n: 0, retard: 0 };
        x.n++;
        if (retard) x.retard++;
        parPersonne.set(e, x);
      }
    }
    for (const [email, x] of parPersonne) {
      await notifier(email, { titre: "avis.lundi.titre", corps: x.retard ? "avis.lundi.corpsRetard" : "avis.lundi.corps", vars: { n: x.n, retard: x.retard } }, "/entretien?vue=interventions&filtre=miennes");
      bilan.resumes++;
    }
    const resp = ctx.config.responsable;
    if (resp) {
      const aValider = ouvertes.filter((iv) => iv.statut === "a_valider").length;
      const aAssigner = ouvertes.filter((iv) => iv.statut === "a_assigner").length;
      const enRetard = ouvertes.filter((iv) => STATUTS_OUVERTS.includes(iv.statut) && iv.echeance && joursAvant(iv.echeance, jour) < 0).length;
      await notifier(resp, { titre: "avis.lundiResp.titre", corps: "avis.lundiResp.corps", vars: { aValider, aAssigner, enRetard } }, "/entretien?vue=interventions");
      bilan.resumes++;
    }
  }
  return bilan;
}
