import "server-only";

import { translator, type Lang, type Vars } from "@/lib/i18n-dict";

// ============================================================
// Avis de l'entretien, envoyés par GANDALF (plan, 2.6) :
//  - cloche et téléphone : POST /api/notifications du hub (clé
//    partagée X-Notif-Key, la même que Tickets Clients) ;
//  - message du bot : POST /api/notifications/dm (même clé), qui
//    écrit aussi sa cloche et son push.
// Le texte est écrit par l'app dans les trois langues ; GANDALF
// choisit celle du destinataire. body_ai = body : le français n'est
// pas réécrit par l'IA. Un envoi raté ne lève jamais d'erreur.
// ============================================================

const LANGS: Lang[] = ["fr", "en", "es"];
const SOURCE = "gestion-salles";

export function hubUrl(): string {
  return (process.env.HUB_URL || process.env.NEXT_PUBLIC_HUB_URL || "https://gandalf.chanv.com").replace(/\/+$/, "");
}

function cle(): string {
  return (process.env.GANDALF_NOTIF_KEY || process.env.NOTIF_API_KEY || "").trim();
}

export function avisConfigures(): boolean {
  return !!cle();
}

/** Lien qui ouvre une page de l'app dans GANDALF (cloche, téléphone, message du bot). */
export function lienApp(chemin: string): string {
  const app = process.env.GESTISALLE_APP_ID || "gestion-salles";
  return `/?app=${encodeURIComponent(app)}&path=${encodeURIComponent(chemin)}`;
}

/** Un texte d'avis : clés du dictionnaire et variables (qui peuvent dépendre de la langue : dates). */
export interface Avis {
  titre: string;
  corps: string;
  vars?: Vars | ((lang: Lang) => Vars);
}

export function textes(a: Avis): Record<Lang, { titre: string; corps: string }> {
  const out = {} as Record<Lang, { titre: string; corps: string }>;
  for (const l of LANGS) {
    const t = translator(l);
    const vars = typeof a.vars === "function" ? a.vars(l) : a.vars;
    out[l] = { titre: t(a.titre, vars), corps: t(a.corps, vars) };
  }
  return out;
}

async function poster(chemin: string, corps: Record<string, unknown>): Promise<boolean> {
  const k = cle();
  if (!k) {
    console.warn(`[entretien] avis non envoyé (clé GANDALF absente) : ${chemin}`);
    return false;
  }
  try {
    const res = await fetch(`${hubUrl()}${chemin}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-notif-key": k },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[entretien] avis refusé par GANDALF (${res.status}) : ${chemin}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[entretien] GANDALF injoignable : ${chemin}`, e instanceof Error ? e.message : e);
    return false;
  }
}

/** Cloche et téléphone. */
export async function notifier(email: string, a: Avis, chemin: string): Promise<boolean> {
  const to = (email || "").trim().toLowerCase();
  if (!to.includes("@")) return false;
  const x = textes(a);
  return poster("/api/notifications", {
    user_email: to,
    source: SOURCE,
    title: x.fr.titre,
    body: x.fr.corps,
    body_ai: x.fr.corps,
    title_en: x.en.titre,
    body_en: x.en.corps,
    title_es: x.es.titre,
    body_es: x.es.corps,
    url: lienApp(chemin),
  });
}

/** Message du bot GANDALF (avec sa cloche et son push). `msgId` stable : renvoyer le même message ne le double pas. */
export async function messageBot(email: string, msgId: string, a: Avis, chemin: string): Promise<boolean> {
  const to = (email || "").trim().toLowerCase();
  if (!to.includes("@")) return false;
  const x = textes(a);
  return poster("/api/notifications/dm", {
    user_email: to,
    source: SOURCE,
    msg_id: msgId,
    text: `${x.fr.titre}\n${x.fr.corps}`,
    text_en: `${x.en.titre}\n${x.en.corps}`,
    text_es: `${x.es.titre}\n${x.es.corps}`,
    title: x.fr.titre,
    title_en: x.en.titre,
    title_es: x.es.titre,
    body: x.fr.corps,
    body_en: x.en.corps,
    body_es: x.es.corps,
    url: lienApp(chemin),
  });
}
