import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { hubUrl } from "./avis";

// ============================================================
// Les tâches GANDALF des interventions (lot 2).
//
//  - Création : la voie machine du hub (POST /api/tasks/service,
//    integration « salles », clé de service partagée). La tâche va
//    dans le projet réglé dans l'app, avec sa liste de contrôle en
//    sous-tâches et sa carte « Salle · Équipement ». GANDALF prévient
//    les personnes assignées. external_key = id de l'intervention :
//    une création rejouée ne double rien.
//  - Gestes d'une personne (terminer, rouvrir, commenter, annuler) :
//    les routes du hub AU NOM de la personne connectée, avec ses droits
//    (même mécanisme que Tickets Clients, src/lib/tickets-hub.ts).
//  - Lecture de l'état : directement dans Firestore (gandalf_tasks),
//    par identifiants, à l'affichage d'une salle et chaque matin.
//    Aucune écoute ni sondage en continu.
// ============================================================

export class HubRefus extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "HubRefus";
  }
}

function cleService(): string {
  return (process.env.GANDALF_NOTIF_KEY || process.env.NOTIF_API_KEY || "").trim();
}

export function tachesConfigurees(): boolean {
  return !!cleService();
}

export interface CarteApp {
  app: string;
  icone: string;
  titre: string;
  detail?: string;
  lignes: { libelle: string; valeur: string; detail?: string }[];
  url: string;
}

export interface TacheACreer {
  externalKey: string;
  titre: string;
  description: string;
  echeance: string | null;
  assignes: string[];
  projetId: string;
  listeId: string | null;
  priorite: "low" | "normal" | "high" | "urgent";
  sousTaches: string[];
  carte: CarteApp;
  notifTitre?: string;
}

/** Crée la tâche par la voie machine. Renvoie son id ; lève HubRefus si GANDALF refuse. */
export async function creerTache(t: TacheACreer): Promise<string> {
  const cle = cleService();
  if (!cle) throw new HubRefus("Clé de service GANDALF absente : la tâche n'est pas créée.", 501);
  const res = await fetch(`${hubUrl()}/api/tasks/service`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cle },
    body: JSON.stringify({
      integration: "salles",
      project_id: t.projetId || undefined,
      list_id: t.listeId || undefined,
      title: t.titre.slice(0, 200),
      description: t.description.slice(0, 6000),
      priority: t.priorite,
      due_date: t.echeance,
      assignees: t.assignes,
      external_key: t.externalKey,
      subtasks: t.sousTaches,
      app_card: t.carte,
      notif_title: t.notifTitre,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { engine?: string; id?: string; error?: string };
  if (!res.ok) throw new HubRefus(j.error || `GANDALF a refusé la tâche (${res.status}).`, res.status);
  if (j.engine !== "gandalf" || !j.id) {
    throw new HubRefus("GANDALF n'accepte pas encore les tâches de Gestion des Salles (levier de migration).", 409);
  }
  return j.id;
}

export interface EtatTache {
  id: string;
  existe: boolean;
  statut: string;
  fermee: boolean;
  fermeeA: string | null;
  fermeePar: string | null;
  archivee: boolean;
  sousTachesFaites: string[];
  piecesJointes: { nom: string; url: string; type: string }[];
}

function iso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  const t = v as { toDate?: () => Date };
  if (typeof t.toDate === "function") return t.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return null;
}

/** Statuts « fait » : done, ou un statut de projet marqué is_done. */
async function statutsFaits(projets: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  const ids = [...new Set(projets.filter(Boolean))];
  if (!ids.length) return out;
  const refs = ids.map((id) => adminDb().collection("gandalf_projects").doc(id));
  const docs = await adminDb().getAll(...refs);
  for (const d of docs) {
    const st = d.data()?.statuses;
    const faits = new Set<string>(["done"]);
    if (Array.isArray(st)) for (const s of st) if (s?.is_done && s.id) faits.add(String(s.id));
    out.set(d.id, faits);
  }
  return out;
}

/** État des tâches (lecture Firestore par identifiants : une lecture par tâche). */
export async function lireTaches(ids: string[]): Promise<Map<string, EtatTache>> {
  const uniques = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, EtatTache>();
  if (!uniques.length) return out;
  const db = adminDb();
  const docs: FirebaseFirestore.DocumentSnapshot[] = [];
  for (let i = 0; i < uniques.length; i += 100) {
    docs.push(...(await db.getAll(...uniques.slice(i, i + 100).map((id) => db.collection("gandalf_tasks").doc(id)))));
  }
  const faits = await statutsFaits(docs.map((d) => (d.data()?.project_id as string) || ""));
  for (const d of docs) {
    const x = d.data();
    if (!x) {
      out.set(d.id, {
        id: d.id, existe: false, statut: "", fermee: false, fermeeA: null, fermeePar: null,
        archivee: true, sousTachesFaites: [], piecesJointes: [],
      });
      continue;
    }
    const statut = String(x.status || "open");
    const fait = (faits.get(x.project_id) ?? new Set(["done"])).has(statut);
    out.set(d.id, {
      id: d.id,
      existe: true,
      statut,
      fermee: fait,
      fermeeA: iso(x.completed_at),
      fermeePar: (x.completed_by as string) || null,
      archivee: x.archived === true,
      sousTachesFaites: (Array.isArray(x.subtasks) ? x.subtasks : [])
        .filter((s: { done?: boolean }) => s?.done)
        .map((s: { text?: string }) => String(s.text || "")),
      piecesJointes: (Array.isArray(x.attachments) ? x.attachments : [])
        .map((a: Record<string, unknown>) => ({
          nom: String(a.name || a.nom || "pièce jointe"),
          url: String(a.url || a.download_url || ""),
          type: String(a.mime || a.type || ""),
        }))
        .filter((a: { url: string }) => /^https:\/\//.test(a.url)),
    });
  }
  return out;
}

// ── Au nom de la personne connectée ──

export interface Personne {
  uid: string;
  email: string;
}

const jetons = new Map<string, { jeton: string; expire: number }>();

function courrielDuJeton(jwt: string): string {
  try {
    const charge = JSON.parse(Buffer.from(jwt.split(".")[1] || "", "base64url").toString("utf8"));
    return typeof charge.email === "string" ? charge.email.toLowerCase() : "";
  } catch {
    return "";
  }
}

async function jetonPour(qui: Personne): Promise<string> {
  const c = jetons.get(qui.uid);
  if (c && c.expire - 5 * 60_000 > Date.now()) return c.jeton;
  let perso: string;
  try {
    perso = await adminAuth().createCustomToken(qui.uid);
  } catch (e) {
    console.warn("[entretien] createCustomToken impossible :", e instanceof Error ? e.message : e);
    throw new HubRefus("Gestion des Salles ne peut pas agir dans GANDALF en votre nom pour le moment.", 503);
  }
  const cle = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!cle) throw new HubRefus("Configuration Firebase absente : impossible d'agir dans GANDALF.", 501);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(cle)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: perso, returnSecureToken: true }),
      signal: AbortSignal.timeout(10_000),
    }
  );
  const j = (await res.json().catch(() => ({}))) as { idToken?: unknown; expiresIn?: unknown };
  if (!res.ok || typeof j.idToken !== "string") throw new HubRefus("GANDALF n'a pas reconnu la session.", 502);
  if (courrielDuJeton(j.idToken) !== qui.email.toLowerCase()) {
    throw new HubRefus("Le jeton GANDALF ne correspond pas à la personne connectée.", 403);
  }
  jetons.set(qui.uid, { jeton: j.idToken, expire: Date.now() + (Number(j.expiresIn) || 3600) * 1000 });
  return j.idToken;
}

async function appeler(qui: Personne, methode: "POST" | "PATCH", chemin: string, corps: unknown): Promise<Record<string, unknown>> {
  for (let essai = 0; essai < 2; essai++) {
    const jeton = await jetonPour(qui);
    const res = await fetch(`${hubUrl()}${chemin}`, {
      method: methode,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401 && essai === 0) {
      jetons.delete(qui.uid);
      continue;
    }
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const brut = typeof j.error === "string" ? j.error : "";
      throw new HubRefus(brut || `GANDALF a refusé (${res.status}).`, res.status);
    }
    return j;
  }
  throw new HubRefus("GANDALF refuse la session.", 401);
}

/** Ferme (fait) ou rouvre la tâche, au nom de la personne. */
export async function changerStatut(qui: Personne, tacheId: string, fait: boolean): Promise<void> {
  await appeler(qui, "PATCH", `/api/tasks/${encodeURIComponent(tacheId)}`, { status: fait ? "done" : "open" });
}

/** Change les personnes assignées, au nom de la personne. */
export async function changerAssignes(qui: Personne, tacheId: string, emails: string[]): Promise<void> {
  await appeler(qui, "PATCH", `/api/tasks/${encodeURIComponent(tacheId)}`, { assignees: emails });
}

export async function commenter(qui: Personne, tacheId: string, texte: string): Promise<void> {
  await appeler(qui, "POST", `/api/tasks/${encodeURIComponent(tacheId)}/comments`, {
    content: texte.slice(0, 4000),
    client_request_id: `salles-${tacheId}-${Date.now()}`,
  });
}

/** Geste GANDALF qui ne doit pas bloquer le geste de l'app : l'échec est rendu, pas levé. */
export async function essayer(f: () => Promise<void>): Promise<string | null> {
  try {
    await f();
    return null;
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[entretien] geste GANDALF non fait :", m);
    return m;
  }
}
