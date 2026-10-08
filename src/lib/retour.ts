// ============================================================
// Page où revenir après la connexion (code QR d'une salle scanné sans
// session). Seul un chemin de l'app est accepté : jamais une autre
// adresse (pas de redirection ouverte), jamais la page de connexion.
// ============================================================

export function cheminDeRetour(v: string | null | undefined): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.length > 500) return null;
  if (/^\/(login|api\/)/.test(s) || s === "/") return null;
  if (/[\u0000-\u001f]/.test(s)) return null;
  return s;
}
