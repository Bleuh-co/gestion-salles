import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import type { AuditAction, AuditLogEntry, AuditTarget } from "@/lib/types";

// ============================================================
// Repo Audit — journal des modifications (collection "audit_logs").
//
// Chaque écriture CRUD (locaux, actifs) enregistre une entrée :
// qui, quoi, quand, et le diff avant/après champ par champ.
// ============================================================

const COLLECTION = "audit_logs";

export interface LogAuditInput {
  action: AuditAction;
  target: AuditTarget;
  targetId: string;
  targetName: string;
  changes?: Record<string, { before: string; after: string }>;
  user: string;
}

/** Écrit une entrée d'audit. Ne jette jamais (l'audit ne doit pas bloquer l'écriture métier). */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const entry = {
      ...input,
      changes: input.changes ?? null,
      timestamp: new Date().toISOString(),
    };
    await adminDb().collection(COLLECTION).add(entry);
  } catch (e) {
    console.error("[audit] Failed to write audit log", e);
  }
}

/** Dernières entrées d'audit, les plus récentes en premier. */
export async function getAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
  const snap = await adminDb()
    .collection(COLLECTION)
    .orderBy("timestamp", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      action: data.action,
      target: data.target,
      targetId: data.targetId ?? "",
      targetName: data.targetName ?? "",
      changes: data.changes ?? undefined,
      user: data.user ?? "",
      timestamp: data.timestamp ?? "",
    } as AuditLogEntry;
  });
}

/** Calcule le diff avant/après (chaînifié) entre deux objets, limité aux champs modifiés. */
export function computeChanges<T extends Record<string, unknown>>(
  before: T | null,
  after: Partial<T>
): Record<string, { before: string; after: string }> {
  const changes: Record<string, { before: string; after: string }> = {};
  for (const [k, v] of Object.entries(after)) {
    if (v === undefined) continue;
    const prev = before ? before[k] : undefined;
    const prevStr = prev === undefined || prev === null ? "" : String(prev);
    const nextStr = v === null ? "" : String(v);
    if (prevStr !== nextStr) {
      changes[k] = { before: prevStr, after: nextStr };
    }
  }
  return changes;
}
