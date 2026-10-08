import "server-only";

import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { firebaseAdmin } from "@/lib/firebase-admin";
import type { Fichier } from "./types";

// ============================================================
// Photos et preuves de l'entretien : un seau Cloud Storage propre à
// l'app, sans accès public. Les fichiers sont servis à travers
// l'app (/api/fichiers/…), après vérification de la session.
// ============================================================

export const SEAU = process.env.ENTRETIEN_SEAU || "antigravity-20260107-gestion-salles";

/** Types acceptés : photos et documents (rapport, facture). */
const TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);
export const TAILLE_MAX = 15 * 1024 * 1024;

export function seau() {
  return getStorage(firebaseAdmin()).bucket(SEAU);
}

export function typeAccepte(type: string): boolean {
  return TYPES.has(type);
}

function nomPropre(nom: string): string {
  const base = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-");
  return base.replace(/^-+|-+$/g, "").slice(-80) || "fichier";
}

/** Range un fichier sous `dossier/` et renvoie sa description (chemin servi par l'app). */
export async function deposer(
  dossier: string,
  fichier: File,
  par: { email: string; nom: string }
): Promise<Fichier> {
  if (!typeAccepte(fichier.type)) throw new Error("TYPE");
  if (fichier.size > TAILLE_MAX) throw new Error("TAILLE");
  const chemin = `${dossier.replace(/^\/+|\/+$/g, "")}/${randomUUID().slice(0, 8)}-${nomPropre(fichier.name)}`;
  const contenu = Buffer.from(await fichier.arrayBuffer());
  await seau().file(chemin).save(contenu, {
    contentType: fichier.type,
    resumable: false,
    metadata: { cacheControl: "private, max-age=86400", metadata: { par: par.email } },
  });
  return {
    chemin,
    nom: fichier.name.slice(0, 120),
    type: fichier.type,
    taille: fichier.size,
    par: par.email,
    parNom: par.nom,
    a: new Date().toISOString(),
  };
}

/** Lit un fichier du seau (contenu et type), ou null s'il n'existe pas. */
export async function lire(chemin: string): Promise<{ contenu: Buffer; type: string } | null> {
  if (!chemin || chemin.includes("..")) return null;
  const f = seau().file(chemin);
  const [existe] = await f.exists();
  if (!existe) return null;
  const [[contenu], [meta]] = await Promise.all([f.download(), f.getMetadata()]);
  return { contenu, type: (meta.contentType as string) || "application/octet-stream" };
}

/** Adresse d'un fichier dans l'app. */
export function urlFichier(f: Pick<Fichier, "chemin" | "url">): string {
  if (f.chemin) return `/api/fichiers/${f.chemin.split("/").map(encodeURIComponent).join("/")}`;
  return f.url || "";
}
