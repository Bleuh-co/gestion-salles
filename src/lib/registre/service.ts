import "server-only";

import type { Actif, Local } from "@/lib/types";
import { getAllActifs } from "@/lib/repo/actifs";
import { getLocal, getLocaux } from "@/lib/repo/locaux";
import { evenementsSalle, evenementsSalles } from "@/lib/repo/registre";
import { getPeriodes, synchroniserPeriodes } from "@/lib/repo/rattachements";
import { historiqueComplet, lireReleves } from "@/lib/repo/releves";
import { isAnySensorProviderConfigured, listAllSensors } from "@/lib/sensors";
import { loadOverrides } from "@/lib/sensor-match";
import { matchAllSensors, type MatchedSensor } from "@/lib/sensor-match-core";
import { lireDateInstall } from "./actifs";
import {
  moyenneParPas,
  parJour,
  resumerParJour,
  statsPeriode,
  type Fenetre,
  type Plage,
  type Point,
  type PointJour,
  type ResumeJour,
  type SerieCapteur,
  type StatsPeriode,
} from "./mesures";
import { viseEcart, type RefEcart } from "./notes";
import { bornesPeriode, pasCourbe, type Bornes } from "./periode";
import { fenetresDeSalle, periodeEnCours, type Periode } from "./rattachement";
import { debutJour, joursEntre, lireHeureUtc, OUVERTURE_DONNEES } from "./temps";
import type { ActionEvenement, EvenementSalle, LigneRegistre, PlagesSalle, SorteLigne } from "./types";

// ============================================================
// Le registre d'une salle sur une période : lignes écrites,
// lignes calculées (capteur posé ou parti, écarts, silences),
// mesures et chiffres. Utilisé par l'onglet Registre, l'onglet
// Capteurs, l'export Excel et la version imprimable.
// ============================================================

const INTERVALLE_DEFAUT_S = 3600;

export function plagesDe(l: Local): PlagesSalle {
  return {
    tempMin: l.plageTempMin ?? null,
    tempMax: l.plageTempMax ?? null,
    humMin: l.plageHumMin ?? null,
    humMax: l.plageHumMax ?? null,
    seuil: l.plageSeuil && l.plageSeuil >= 1 ? Math.round(l.plageSeuil) : 2,
  };
}

const plageC = (p: PlagesSalle): Plage => ({ min: p.tempMin, max: p.tempMax });
const plageH = (p: PlagesSalle): Plage => ({ min: p.humMin, max: p.humMax });

export interface EtatCapteurs {
  capteurs: MatchedSensor[];
  periodes: Periode[];
}

/** Capteurs du fournisseur + périodes datées, mises à jour au passage. */
export async function etatCapteurs(): Promise<EtatCapteurs> {
  if (!isAnySensorProviderConfigured()) return { capteurs: [], periodes: await getPeriodes() };
  const [sensors, overrides, locaux] = await Promise.all([
    listAllSensors(),
    loadOverrides(),
    getLocaux({ includeArchived: true }),
  ]);
  const capteurs = matchAllSensors(sensors, locaux.map((l) => l.id), overrides);
  try {
    await synchroniserPeriodes(capteurs, (s) => historiqueComplet(s));
  } catch (e) {
    console.error("[registre] synchronisation des rattachements", e);
  }
  return { capteurs, periodes: await getPeriodes() };
}

export interface InfoCapteur {
  sensorId: string;
  nom: string;
  intervalleS: number;
  /** Début de la présence en cours dans la salle (ms), null si le capteur n'y est plus. */
  depuis: number | null;
  confirme: boolean;
  enLigne: boolean | null;
  batterie: number | null;
  derniereC: number | null;
  derniereH: number | null;
  derniereA: string | null;
  fenetres: Fenetre[];
}

const ENTRETIEN: ActionEvenement[] = [
  "entretien_ajoute",
  "entretien_modifie",
  "entretien_retire",
  "probleme_signale",
  "entretien_fait",
  "intervention_validee",
  "intervention_refusee",
  "intervention_annulee",
  "actif_hors_service",
  "actif_remis_en_service",
];

function sorteDe(action: ActionEvenement): SorteLigne {
  if (ENTRETIEN.includes(action)) return "entretien";
  if (action === "registre_exporte") return "export";
  if (action === "note") return "note";
  if (action === "ecart_justifie") return "ecart";
  if (action.startsWith("item_")) return "item";
  if (
    action === "salle_creee" ||
    action === "fiche_modifiee" ||
    action === "salle_archivee" ||
    action === "salle_restauree" ||
    action === "salle_supprimee" ||
    action === "plage_modifiee"
  )
    return "fiche";
  return "actif";
}

export function ligneEcrite(e: EvenementSalle): LigneRegistre {
  const t = Date.parse(e.at);
  const ins = Date.parse(e.inscritA);
  return {
    id: e.id,
    sorte: sorteDe(e.action),
    t,
    jourSeulement: e.jourSeulement,
    type: e.action,
    salleId: e.salleId,
    par: e.par,
    parNom: e.parNom,
    // « inscrit le … par … » seulement pour un geste fait dans l'app et daté
    // d'avant son inscription (une reprise n'a pas été inscrite par la personne).
    inscritA: e.source === "app" && Math.abs(ins - t) > 10 * 60_000 ? ins : undefined,
    source: e.source,
    cible: e.cible,
    changes: e.changes,
    autreSalle: e.autreSalle,
    motif: e.motif,
    note: e.note,
    details: e.details,
  };
}

const MARGE_JUSTIFICATIONS_MS = 31 * 86_400_000;

/** Ce qu'une justification apporte à la ligne de son écart. */
export interface VueJustification {
  texte: string;
  parNom: string;
  /** ms UTC */
  inscritA: number;
}

interface Justification {
  id: string;
  ref: RefEcart;
  vue: VueJustification;
}

function justificationDe(e: EvenementSalle): Justification | null {
  if (e.action !== "ecart_justifie" || !e.cible?.id) return null;
  const d = e.details ?? {};
  const grandeur = d.grandeur === "c" || d.grandeur === "h" ? d.grandeur : null;
  const debut = typeof d.debut === "number" ? d.debut : Date.parse(e.at);
  const fin = typeof d.fin === "number" ? d.fin : debut;
  if (!grandeur || !Number.isFinite(debut)) return null;
  return {
    id: e.id,
    ref: { sensorId: e.cible.id, grandeur, debut, fin },
    vue: { texte: e.note ?? "", parNom: e.parNom || e.par, inscritA: Date.parse(e.inscritA) },
  };
}

/** Lignes « capteur posé / parti » d'une salle, tirées des périodes datées. */
export function lignesCapteurs(periodes: Periode[], salleId: string | null, du: number, au: number): LigneRegistre[] {
  const out: LigneRegistre[] = [];
  for (const p of periodes) {
    if (salleId !== null && p.salleId !== salleId) continue;
    if (!p.salleId) continue;
    const cible = { type: "capteur" as const, id: p.sensorId, nom: p.sensorName };
    if (p.du >= du && p.du < au) {
      out.push({
        id: `pose_${p.id}`,
        sorte: "capteur",
        t: p.du,
        type: "capteur_pose",
        salleId: p.salleId,
        par: p.par,
        parNom: p.parNom,
        inscritA: Math.abs(p.inscritA - p.du) > 10 * 60_000 ? p.inscritA : undefined,
        source: "rattachement",
        cible,
        details: { confirme: p.confirme, origine: p.source },
      });
    }
    if (p.au != null && p.au >= du && p.au < au) {
      const suivante = periodes.find((x) => x.sensorId === p.sensorId && x.du === p.au);
      out.push({
        id: `parti_${p.id}`,
        sorte: "capteur",
        t: p.au,
        type: "capteur_parti",
        salleId: p.salleId,
        par: suivante?.par ?? "",
        parNom: suivante?.parNom ?? "",
        source: "rattachement",
        cible,
        autreSalle: suivante?.salleId ?? null,
      });
    }
  }
  return out;
}

export interface DonneesSalle {
  salle: Local;
  plages: PlagesSalle;
  bornes: Bornes;
  maintenant: number;
  capteurs: InfoCapteur[];
  /** La salle a (ou a eu) au moins un capteur rattaché. */
  aEuCapteur: boolean;
  series: SerieCapteur[];
  stats: StatsPeriode | null;
  lignes: LigneRegistre[];
  /** Le fournisseur n'a pas répondu pour une partie des jours non copiés. */
  incomplet: boolean;
}

export interface OptionsChargement {
  periode?: string | null;
  du?: string | null;
  au?: string | null;
  mesures?: boolean;
  lignes?: boolean;
  maintenant?: number;
  etat?: EtatCapteurs;
}

/** Tout ce que le registre sait d'une salle sur une période. */
export async function chargerSalle(salleId: string, opts: OptionsChargement = {}): Promise<DonneesSalle | null> {
  const maintenant = opts.maintenant ?? Date.now();
  const salle = await getLocal(salleId);
  if (!salle) return null;
  const plages = plagesDe(salle);
  const etat = opts.etat ?? (await etatCapteurs());
  const periodesSalle = etat.periodes.filter((p) => p.salleId === salleId);
  const debutTout = Math.min(debutJour(OUVERTURE_DONNEES), ...periodesSalle.map((p) => p.du));
  const bornes = bornesPeriode(opts.periode, opts.du, opts.au, maintenant, debutTout);
  const { du, au } = bornes;

  const parCapteur = new Map(etat.capteurs.map((c) => [c.sensor_id, c]));
  const fenetres = fenetresDeSalle(etat.periodes, salleId, du, au);
  const enCours = new Map(
    periodesSalle.filter((p) => p.au == null).map((p) => [p.sensorId, p] as const)
  );
  const ids = [...new Set([...fenetres.keys(), ...enCours.keys()])];
  const capteurs: InfoCapteur[] = ids.map((id) => {
    const c = parCapteur.get(id);
    const p = enCours.get(id) ?? null;
    return {
      sensorId: id,
      nom: c?.sensor_name || periodesSalle.find((x) => x.sensorId === id)?.sensorName || id,
      intervalleS: c?.send_interval_s || INTERVALLE_DEFAUT_S,
      depuis: p?.du ?? null,
      confirme: p?.confirme ?? true,
      enLigne: c ? !c.offline : null,
      batterie: c?.battery ?? null,
      derniereC: c?.last_temp_c ?? null,
      derniereH: c?.last_humidity ?? null,
      derniereA: c?.last_checkin_utc ?? null,
      fenetres: fenetres.get(id) ?? [],
    };
  });

  let series: SerieCapteur[] = [];
  let stats: StatsPeriode | null = null;
  let incomplet = false;
  if (opts.mesures !== false && fenetres.size) {
    series = await Promise.all(
      [...fenetres.entries()].map(async ([id, fen]) => {
        const info = capteurs.find((c) => c.sensorId === id)!;
        const ref = parCapteur.get(id) ?? { sensor_id: id, sensor_name: info.nom, provider: "tempstick" };
        const debut = Math.min(...fen.map((f) => f.du));
        const fin = Math.max(...fen.map((f) => f.au));
        const r = await lireReleves(ref, debut, fin, maintenant);
        if (r.incomplet) incomplet = true;
        return { sensorId: id, nom: info.nom, intervalleMs: info.intervalleS * 1000, fenetres: fen, releves: r.releves };
      })
    );
    stats = statsPeriode(series, du, au, plageC(plages), plageH(plages), maintenant, plages.seuil);
  }

  let lignes: LigneRegistre[] = [];
  if (opts.lignes !== false) {
    // Lu un mois plus tôt : la justification d'un écart commencé avant la
    // période (datée du début de l'écart) s'y rattache quand même.
    const ecrites = await evenementsSalle(
      salleId,
      new Date(du - MARGE_JUSTIFICATIONS_MS).toISOString(),
      new Date(au).toISOString()
    );
    const justifs = ecrites.map(justificationDe).filter((j): j is Justification => j !== null);
    const rattachees = new Set<string>();
    lignes = [
      ...ecrites.filter((e) => Date.parse(e.at) >= du).map(ligneEcrite),
      ...lignesCapteurs(etat.periodes, salleId, du, au),
    ];
    if (stats) {
      for (const e of stats.ecarts) {
        const p = e.grandeur === "c" ? plageC(plages) : plageH(plages);
        const siennes = justifs.filter((j) => viseEcart(j.ref, e));
        for (const j of siennes) rattachees.add(j.id);
        lignes.push({
          id: `ecart_${e.sensorId}_${e.grandeur}_${e.debut}`,
          sorte: "ecart",
          t: e.debut,
          type: "ecart",
          salleId,
          par: "",
          parNom: "",
          source: "calcul",
          cible: { type: "capteur", id: e.sensorId, nom: e.nom },
          details: {
            grandeur: e.grandeur,
            sens: e.sens,
            extreme: e.extreme,
            dureeMin: Math.round((e.fin - e.debut) / 60_000),
            n: e.n,
            enCours: e.enCours,
            min: p.min,
            max: p.max,
            fin: e.fin,
            justifications: siennes.map((j) => j.vue),
          },
        });
      }
      for (const m of stats.muets) {
        lignes.push({
          id: `muet_${m.sensorId}_${m.debut}`,
          sorte: "capteur",
          t: m.debut,
          type: "muet",
          salleId,
          par: "",
          parNom: "",
          source: "calcul",
          cible: { type: "capteur", id: m.sensorId, nom: m.nom },
          details: { dureeMin: Math.round((m.fin - m.debut) / 60_000), manquants: m.manquants, enCours: m.enCours },
        });
      }
    }
    // Une justification rattachée se lit sur la ligne de son écart ; seule
    // (écart recalculé autrement depuis, plage changée), elle reste visible.
    lignes = lignes.filter((l) => !rattachees.has(l.id));
    lignes.sort((a, b) => b.t - a.t);
  }

  return {
    salle,
    plages,
    bornes,
    maintenant,
    capteurs,
    aEuCapteur: periodesSalle.length > 0,
    series,
    stats,
    lignes,
    incomplet,
  };
}

// ---- Courbes (onglet Capteurs) ----------------------------------------------

export interface CourbeCapteur {
  sensorId: string;
  nom: string;
  c: Point[];
  h: Point[];
  /** Pas « jour » : minimum, maximum et moyenne par jour. */
  cJour?: PointJour[];
  hJour?: PointJour[];
}

export interface Courbes {
  pas: "brut" | "heure" | "jour";
  capteurs: CourbeCapteur[];
  moyenne: { c: Point[]; h: Point[] } | null;
  parJour: ResumeJour[];
}

export function courbesDe(d: DonneesSalle): Courbes {
  const pas = pasCourbe(Math.min(d.bornes.au, d.maintenant) - d.bornes.du);
  const pasMs = 3600_000;
  const capteurs: CourbeCapteur[] = d.series.map((s) => {
    const rs = s.releves.filter((r) => s.fenetres.some((f) => r.t >= f.du && r.t < f.au));
    if (pas === "jour") return { sensorId: s.sensorId, nom: s.nom, c: [], h: [], cJour: parJour(rs, "c"), hJour: parJour(rs, "h") };
    if (pas === "brut") {
      const pts = (g: "c" | "h") => rs.filter((r) => r[g] != null).map((r) => ({ t: r.t, v: r[g] as number }));
      return { sensorId: s.sensorId, nom: s.nom, c: pts("c"), h: pts("h") };
    }
    return { sensorId: s.sensorId, nom: s.nom, c: moyenneParPas(rs, "c", pasMs), h: moyenneParPas(rs, "h", pasMs) };
  });
  let moyenne: Courbes["moyenne"] = null;
  if (d.series.length > 1 && pas !== "jour") {
    const tous = d.series.flatMap((s) => s.releves.filter((r) => s.fenetres.some((f) => r.t >= f.du && r.t < f.au)));
    moyenne = { c: moyenneParPas(tous, "c", pasMs), h: moyenneParPas(tous, "h", pasMs) };
  }
  const jours = joursEntre(d.bornes.duJour, d.bornes.auJour).filter((j) => debutJour(j) <= d.maintenant);
  const ecarts = d.stats?.ecarts ?? [];
  const parJ = d.series.length ? resumerParJour(d.series, jours, ecarts, d.maintenant).filter((r) => r.attendus > 0 || r.recus > 0) : [];
  return { pas, capteurs, moyenne, parJour: parJ.reverse() };
}

// ---- Actifs de la salle -------------------------------------------------------

export interface ActifDansSalle {
  actif: Actif;
  /** ms UTC ; null = inconnu. */
  depuis: number | null;
  origine: "installation" | "ouverture" | "mouvement" | "correction";
}

/** « Dans la salle depuis » (V4) : dernier mouvement, sinon installation, sinon ouverture du registre. */
export async function actifsDeLaSalle(salleId: string, actifs: Actif[]): Promise<ActifDansSalle[]> {
  const evts = await evenementsSalle(salleId).catch(() => [] as EvenementSalle[]);
  const ouverture = evts.find((e) => e.action === "ouverture");
  return actifs.map((a) => {
    const arrivee = evts.find(
      (e) =>
        e.cible?.id === a.id &&
        (e.action === "actif_entre" || e.action === "actif_ajoute" || e.action === "actif_corrige")
    );
    if (arrivee && arrivee.action !== "actif_corrige") {
      return { actif: a, depuis: Date.parse(arrivee.at), origine: "mouvement" as const };
    }
    const install = lireDateInstall(a.dateInstall);
    if (install) return { actif: a, depuis: debutJour(install) + 12 * 3600_000, origine: "installation" as const };
    if (arrivee) return { actif: a, depuis: Date.parse(arrivee.at), origine: "correction" as const };
    return { actif: a, depuis: ouverture ? Date.parse(ouverture.at) : null, origine: "ouverture" as const };
  });
}

/**
 * Actifs présents dans la salle à un instant : l'état actuel, en défaisant
 * les mouvements inscrits après cet instant (une correction de données
 * n'est pas défaite : l'actif y était déjà).
 */
export async function actifsPresentsA(salleId: string, t: number): Promise<Actif[]> {
  const tous = await getAllActifs();
  const presents = new Map(tous.filter((a) => a.idSalle === salleId).map((a) => [a.id, a]));
  if (t >= Date.now()) return [...presents.values()];
  const apres = await evenementsSalle(salleId, new Date(t).toISOString());
  for (const e of apres.sort((a, b) => b.at.localeCompare(a.at))) {
    const id = e.cible?.id;
    if (!id || e.cible?.type !== "actif") continue;
    if (e.action === "actif_entre" || e.action === "actif_ajoute") presents.delete(id);
    if (e.action === "actif_sorti" || e.action === "actif_retire" || e.action === "actif_supprime") {
      const a = tous.find((x) => x.id === id);
      presents.set(id, a ?? ({ id, nom: e.cible.nom, matricule: e.cible.matricule ?? "", statut: "" } as Actif));
    }
  }
  return [...presents.values()].sort((a, b) => (a.matricule || a.id).localeCompare(b.matricule || b.id, "fr", { numeric: true }));
}

// ---- Toutes les salles (Administration › Registre) -----------------------------

/** Lignes de toutes les salles sur [du, au) : écrites + capteurs posés, partis, nouveaux. */
export async function registreGlobal(du: number, au: number, salleIds: string[]): Promise<LigneRegistre[]> {
  const [ecrites, etat] = await Promise.all([
    evenementsSalles(salleIds, new Date(du).toISOString(), new Date(au).toISOString()),
    etatCapteurs(),
  ]);
  const choisies = new Set(salleIds);
  const lignes = [
    ...ecrites.map(ligneEcrite),
    ...lignesCapteurs(etat.periodes, null, du, au).filter((l) => l.salleId && choisies.has(l.salleId)),
  ];
  // Capteurs posés chez le fournisseur pendant la période (date de création).
  for (const c of etat.capteurs) {
    const cree = lireHeureUtc(c.created_utc ?? null);
    if (cree == null || cree < du || cree >= au) continue;
    const p = etat.periodes.find((x) => x.sensorId === c.sensor_id && x.du <= cree && cree < (x.au ?? Infinity));
    const salleId = p?.salleId ?? null;
    if (salleId && !choisies.has(salleId)) continue;
    lignes.push({
      id: `nouveau_${c.sensor_id}`,
      sorte: "capteur",
      t: cree,
      type: "capteur_nouveau",
      salleId,
      par: "",
      parNom: "",
      source: "fournisseur",
      cible: { type: "capteur", id: c.sensor_id, nom: c.sensor_name || c.sensor_id },
      details: { sansSalle: !periodeEnCours(etat.periodes, c.sensor_id)?.salleId },
    });
  }
  return lignes.sort((a, b) => b.t - a.t);
}
