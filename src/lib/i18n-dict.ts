/**
 * Dictionnaire trilingue FR/EN/ES du chrome Gestion Salles (UI uniquement).
 *
 * IMPORTANT : les DONNÉES métier (noms de salles, familles, actifs, valeurs
 * capteurs — données Firestore) ne sont PAS traduites ici ; seul le chrome l'est.
 *
 * Module « plat » sans directive : importable côté client (src/lib/i18n.ts,
 * hook useT) comme côté serveur (src/lib/i18n-server.ts, getServerT).
 * Repli : fr, puis la clé elle-même. Interpolation {var} optionnelle.
 * ES : tutoiement (« tú »), comme le reste du parc.
 *
 * Parité stricte ×3 vérifiée par scripts/check-i18n-parity.mjs (npm run check:i18n).
 */

export type Lang = "fr" | "en" | "es";

/** Locale de formatage (dates, nombres) par langue. */
export const LANG_LOCALES: Record<Lang, string> = {
  fr: "fr-CA",
  en: "en-CA",
  es: "es",
};

export const MESSAGES: Record<Lang, Record<string, string>> = {
  fr: {
    // Navigation / chrome
    "app.title": "Gestion Salles",
    "nav.subtitle": "Groupe Chanv",
    "nav.rooms": "Locaux",
    "nav.admin": "Administration",
    "nav.backToHub": "Retour au Hub",
    "nav.menu": "Menu",

    // Rôles
    "role.superadmin": "Super Administrateur",
    "role.admin": "Administrateur",
    "role.membre": "Membre",
    "role.blocked": "Bloqué",
  },
  en: {
    // Navigation / chrome
    "app.title": "Room Management",
    "nav.subtitle": "Groupe Chanv",
    "nav.rooms": "Rooms",
    "nav.admin": "Administration",
    "nav.backToHub": "Back to Hub",
    "nav.menu": "Menu",

    // Rôles
    "role.superadmin": "Super Administrator",
    "role.admin": "Administrator",
    "role.membre": "Member",
    "role.blocked": "Blocked",
  },
  es: {
    // Navigation / chrome
    "app.title": "Gestión de Salas",
    "nav.subtitle": "Groupe Chanv",
    "nav.rooms": "Salas",
    "nav.admin": "Administración",
    "nav.backToHub": "Volver al Hub",
    "nav.menu": "Menú",

    // Rôles
    "role.superadmin": "Superadministrador",
    "role.admin": "Administrador",
    "role.membre": "Miembro",
    "role.blocked": "Bloqueado",
  },
};

export type Vars = Record<string, string | number>;

export function format(s: string, vars?: Vars): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/** Traducteur autonome pour une langue donnée (sans contexte React). */
export function translator(lang: Lang) {
  return (key: string, vars?: Vars): string =>
    format(MESSAGES[lang]?.[key] ?? MESSAGES.fr[key] ?? key, vars);
}

export function normalizeLang(v: string | undefined | null): Lang {
  if (v === "en" || v === "es" || v === "fr") return v;
  return "fr";
}
