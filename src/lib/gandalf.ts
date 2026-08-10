import "server-only";
import type { AdminLike } from "@bleuh-co/gandalf-sdk-next/server";
import { adminAuth, adminDb } from "./firebase-admin";
import { resolveRole, isEmailAllowed } from "./auth-server";

/**
 * Adaptateur firebase-admin → contrat AdminLike du SDK Gandalf (modèle elearning).
 * L'app expose adminAuth()/adminDb() ; le SDK attend admin.auth()/admin.firestore().
 */
export const gandalfAdmin: AdminLike = {
  auth: () => adminAuth() as any,
  firestore: () => adminDb() as any,
};

/**
 * roleMapper : branche la résolution de rôle propre à Gestion Salles dans le
 * SDK — règles EXACTES de l'ancien getSession, zéro régression :
 *   1. gate d'accès (isEmailAllowed = domaine autorisé OU whitelisté
 *      users.invited) → sinon "blocked",
 *   2. resolveRole (bootstrap super admins → user_app_roles
 *      `${email}__${appId}` (GESTISALLE_APP_ID ou matcher par nom) →
 *      users.role legacy → défaut deny-by-default "blocked").
 * "blocked" est listé dans noAccessRoles → refus (deny-by-default).
 */
export const gestionSallesRoleMapper = async (email: string): Promise<string> => {
  if (!(await isEmailAllowed(email))) return "blocked";
  return resolveRole(email);
};
