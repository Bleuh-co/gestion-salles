"use client";

import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { FUSEAU } from "@/lib/registre/temps";
import type { Frequence, StatutIntervention } from "@/lib/entretien/types";

// ============================================================
// Briques communes des écrans de l'entretien.
// ============================================================

export type { InterventionVue, RegleVue, VueSalle, VueActif, FichierVue, ActifEntretien, LigneCalendrier } from "@/lib/entretien/vues";

/** « 6 avr. 2026 » pour un jour AAAA-MM-JJ. */
export function jourCourt(jour: string | null | undefined, locale: string, annee = true): string {
  if (!jour) return "—";
  const t = Date.parse(`${jour}T12:00:00Z`);
  if (Number.isNaN(t)) return jour;
  return new Intl.DateTimeFormat(locale, { timeZone: FUSEAU, day: "numeric", month: "short", ...(annee ? { year: "numeric" } : {}) }).format(t);
}

export function jourLong(jour: string | null | undefined, locale: string): string {
  if (!jour) return "—";
  const t = Date.parse(`${jour}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale, { timeZone: FUSEAU, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(t);
}

export function instantCourt(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: FUSEAU, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(Date.parse(iso));
}

export function useFrequence() {
  const t = useT();
  return (f: Frequence | null | undefined): string => {
    if (!f) return t("entretien.freq.aucune");
    if (f.type === "ponctuelle") return t("entretien.freq.ponctuelle");
    if (f.type === "saisonniere") return t("entretien.freq.saison", { mois: f.mois.join(", ") });
    if (f.n === 1) return t(`entretien.freq.chaque.${f.unite}`);
    if (f.unite === "mois" && f.n === 6) return t("entretien.freq.semestrielle");
    if (f.unite === "mois" && f.n === 3) return t("entretien.freq.trimestrielle");
    return t(`entretien.freq.tous.${f.unite}`, { n: f.n });
  };
}

const TONS: Record<StatutIntervention, string> = {
  a_assigner: "bg-amber-100 text-amber-800",
  a_faire: "bg-sky-100 text-sky-800",
  en_cours: "bg-indigo-100 text-indigo-800",
  en_attente: "bg-slate-100 text-slate-700",
  a_valider: "bg-yellow-100 text-yellow-800",
  validee: "bg-emerald-100 text-emerald-800",
  annulee: "bg-slate-100 text-slate-500",
};

export function BadgeStatut({ statut }: { statut: StatutIntervention }) {
  const t = useT();
  return <span className={`badge text-[11px] whitespace-nowrap ${TONS[statut]}`}>{t(`entretien.statut.${statut}`)}</span>;
}

/** « 184 j de retard », « aujourd'hui », « dans 12 j ». */
export function BadgeRetard({ retard }: { retard: number | null }) {
  const t = useT();
  if (retard == null) return null;
  if (retard > 0) return <span className="badge text-[11px] whitespace-nowrap bg-red-100 text-red-700">{t("entretien.retardJ", { n: retard })}</span>;
  if (retard === 0) return <span className="badge text-[11px] whitespace-nowrap bg-orange-100 text-orange-700">{t("entretien.aujourdhui")}</span>;
  return <span className="badge text-[11px] whitespace-nowrap bg-slate-100 text-slate-600">{t("entretien.dansJ", { n: -retard })}</span>;
}

export interface PersonneOption {
  email: string;
  nom: string;
}

let personnesCache: Promise<PersonneOption[]> | null = null;

export function usePersonnes(): PersonneOption[] {
  const [liste, setListe] = useState<PersonneOption[]>([]);
  useEffect(() => {
    if (!personnesCache) {
      personnesCache = fetch("/api/entretien/personnes")
        .then((r) => (r.ok ? r.json() : { personnes: [] }))
        .then((d) => (d.personnes ?? []) as PersonneOption[])
        .catch(() => []);
    }
    let vivant = true;
    personnesCache.then((p) => vivant && setListe(p));
    return () => {
      vivant = false;
    };
  }, []);
  return liste;
}

/** Choix d'une personne de l'annuaire (recherche par nom ou adresse). */
export function ChoixPersonne({
  valeur,
  onChange,
  placeholder,
  id,
}: {
  valeur: string;
  onChange: (email: string) => void;
  placeholder?: string;
  id?: string;
}) {
  const personnes = usePersonnes();
  const [texte, setTexte] = useState("");
  const liste = id || "personnes-entretien";
  useEffect(() => {
    const p = personnes.find((x) => x.email === valeur);
    setTexte(p ? `${p.nom} <${p.email}>` : valeur);
  }, [valeur, personnes]);
  return (
    <>
      <input
        list={liste}
        value={texte}
        placeholder={placeholder}
        onChange={(e) => {
          setTexte(e.target.value);
          const m = /<([^>]+)>\s*$/.exec(e.target.value);
          const email = (m ? m[1] : e.target.value).trim().toLowerCase();
          if (!e.target.value.trim()) onChange("");
          else if (personnes.some((p) => p.email === email)) onChange(email);
        }}
        className="w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
      />
      <datalist id={liste}>
        {personnes.map((p) => (
          <option key={p.email} value={`${p.nom} <${p.email}>`} />
        ))}
      </datalist>
    </>
  );
}

export async function envoyer<T = Record<string, unknown>>(
  url: string,
  methode: "POST" | "PATCH" | "PUT" | "DELETE",
  corps?: unknown
): Promise<{ ok: true; data: T } | { ok: false; erreur: string }> {
  try {
    const r = await fetch(url, {
      method: methode,
      headers: corps instanceof FormData ? undefined : { "content-type": "application/json" },
      body: corps instanceof FormData ? corps : corps === undefined ? undefined : JSON.stringify(corps),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, erreur: (d as { error?: string }).error || `HTTP ${r.status}` };
    return { ok: true, data: d as T };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Photo prise au téléphone : réduite à 1600 px et ré-encodée en JPEG avant
 * l'envoi (une photo de 6 Mo met longtemps à partir sur le réseau d'une usine).
 * Un format que le navigateur ne sait pas lire (HEIC) part tel quel.
 */
export async function reduirePhoto(f: File, max = 1600): Promise<File> {
  if (!f.type.startsWith("image/") || f.type === "image/heic" || f.type === "image/heif") return f;
  try {
    const bitmap = await createImageBitmap(f);
    const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (k === 1 && f.size < 900_000) return f;
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * k);
    c.height = Math.round(bitmap.height * k);
    c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
    if (!blob) return f;
    return new File([blob], f.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return f;
  }
}

export function useLocaleT() {
  return { t: useT(), locale: useLocale() };
}
