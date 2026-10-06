// ============================================================
// Petits outils sur les actifs pour le registre (module pur).
// ============================================================

/** Codes de salle d'un champ « locaux desservis » (liste séparée par , ; / ou retour). */
export function sallesDesservies(locauxDesservis: string): string[] {
  return [
    ...new Set(
      (locauxDesservis || "")
        .split(/[,;\n/]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

/** Date d'installation lisible (AAAA-MM-JJ, JJ/MM/AAAA, AAAA/MM/JJ) → AAAA-MM-JJ, sinon null. */
export function lireDateInstall(s: string): string | null {
  const v = (s || "").trim();
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valide(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return valide(+m[3], +m[2], +m[1]);
  return null;
}

function valide(y: number, mo: number, d: number): string | null {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const x = new Date(Date.UTC(y, mo - 1, d));
  if (x.getUTCMonth() !== mo - 1) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Motifs proposés (V4). Le texte affiché vient des traductions. */
export const MOTIFS_DEPLACEMENT = ["reaffectation", "maintenance", "pret", "reorganisation", "autre"] as const;
export const MOTIFS_RETRAIT = ["reforme", "vendu", "reparation", "pret", "perdu", "autre"] as const;
export const MOTIFS_AJOUT = ["installation", "reaffectation", "retour", "autre"] as const;
