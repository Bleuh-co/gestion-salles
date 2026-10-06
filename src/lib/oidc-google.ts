import "server-only";

import { createPublicKey, createVerify, type JsonWebKey } from "node:crypto";

// ============================================================
// Vérification d'un jeton d'identité Google (OIDC), tel que l'envoie
// Cloud Scheduler à une route HTTP (« Ajouter un jeton OIDC »).
// Sans secret à gérer ni dépendance : signature RS256 vérifiée avec
// les clés publiques de Google, puis émetteur, audience, expiration
// et compte de service.
// ============================================================

const CERTS = "https://www.googleapis.com/oauth2/v3/certs";
let cache: { keys: (JsonWebKey & { kid?: string })[]; expire: number } | null = null;

async function cles(forcer = false) {
  if (!forcer && cache && Date.now() < cache.expire) return cache.keys;
  const res = await fetch(CERTS, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Clés Google indisponibles (${res.status})`);
  const max = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1] || 3600);
  const data = (await res.json()) as { keys: (JsonWebKey & { kid?: string })[] };
  cache = { keys: data.keys, expire: Date.now() + Math.min(max, 6 * 3600) * 1000 };
  return cache.keys;
}

const json = (b64: string) => JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));

export interface JetonGoogle {
  email: string;
  aud: string;
}

/** Jeton valide pour l'une des audiences et l'un des comptes permis, sinon null. */
export async function verifierJetonGoogle(
  jeton: string,
  audiences: string[],
  comptes: (email: string) => boolean
): Promise<JetonGoogle | null> {
  try {
    const [h, p, s] = jeton.split(".");
    if (!h || !p || !s) return null;
    const entete = json(h);
    const corps = json(p);
    if (entete.alg !== "RS256" || !entete.kid) return null;
    let cle = (await cles()).find((k) => k.kid === entete.kid);
    if (!cle) cle = (await cles(true)).find((k) => k.kid === entete.kid);
    if (!cle) return null;
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${p}`);
    if (!v.verify(createPublicKey({ key: cle, format: "jwk" }), Buffer.from(s, "base64url"))) return null;
    const maintenant = Date.now() / 1000;
    if (corps.iss !== "https://accounts.google.com" && corps.iss !== "accounts.google.com") return null;
    if (!audiences.includes(corps.aud)) return null;
    if (!(corps.exp > maintenant - 60) || !(corps.iat < maintenant + 300)) return null;
    if (corps.email_verified !== true || typeof corps.email !== "string" || !comptes(corps.email)) return null;
    return { email: corps.email, aud: corps.aud };
  } catch (e) {
    console.warn("[oidc] jeton refusé", e instanceof Error ? e.message : e);
    return null;
  }
}
