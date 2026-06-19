"use client";

import { useState, useMemo } from "react";
import type { Local, Actif, AuditLogEntry, LocalStatut } from "@/lib/types";
import { LOCAL_STATUT_LABELS, FAMILLE_COLORS } from "@/lib/types";
import { LocalStatusBadge } from "@/components/LocalStatusBadge";
import { EmptyState } from "@/components/EmptyState";
import {
  Building, Wrench, ClipboardList, Search, Plus, Pencil, Trash2, RotateCcw,
  ChevronDown, ChevronUp, X, Save, Clock, User
} from "lucide-react";

// ============================================================
// Admin Client
// ============================================================

interface AdminClientProps {
  locaux: Local[];
  actifs: Actif[];
  auditLogs: AuditLogEntry[];
}

const ADMIN_TABS = [
  { key: "locaux", label: "Locaux", icon: Building },
  { key: "actifs", label: "Actifs", icon: Wrench },
  { key: "logs", label: "Audit Logs", icon: ClipboardList },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["key"];

export function AdminClient({ locaux: initialLocaux, actifs, auditLogs }: AdminClientProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("locaux");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-chanv-terre">Administration</h1>
        <p className="text-sm text-slate-500 mt-1">
          Gestion des locaux, actifs et audit
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-chanv-fibre" role="tablist">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count = tab.key === "locaux" ? initialLocaux.length :
            tab.key === "actifs" ? actifs.length :
            auditLogs.length;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl whitespace-nowrap transition-all ${
                isActive
                  ? "bg-chanv-fibre text-chanv-terre border-b-2 border-chanv-beige -mb-px"
                  : "text-slate-500 hover:text-chanv-terre hover:bg-chanv-fibre/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-chanv-terre/10 text-chanv-terre font-bold">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-chanv-fibre bg-white text-sm focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
          />
        </div>
        {activeTab === "locaux" && (
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded"
            />
            Archivés
          </label>
        )}
      </div>

      {/* Content */}
      {activeTab === "locaux" && (
        <AdminLocauxTable locaux={initialLocaux} search={searchQuery} showArchived={showArchived} />
      )}
      {activeTab === "actifs" && (
        <AdminActifsTable actifs={actifs} search={searchQuery} />
      )}
      {activeTab === "logs" && (
        <AdminAuditLog logs={auditLogs} search={searchQuery} />
      )}
    </div>
  );
}

// ============================================================
// Locaux Table
// ============================================================

function AdminLocauxTable({ locaux, search, showArchived }: { locaux: Local[]; search: string; showArchived: boolean }) {
  const filtered = useMemo(() => {
    let result = locaux;
    if (!showArchived) result = result.filter((l) => !l.archived);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.id.toLowerCase().includes(q) ||
          l.nomSalle.toLowerCase().includes(q) ||
          l.famille.toLowerCase().includes(q) ||
          l.vocation.toLowerCase().includes(q)
      );
    }
    return result;
  }, [locaux, search, showArchived]);

  if (filtered.length === 0) {
    return <EmptyState icon="🏢" title="Aucun local" description="Aucun local ne correspond aux critères." />;
  }

  return (
    <div className="section-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chanv-fibre text-left">
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">ID</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Famille</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Étage</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Vocation</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Statut</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Accès</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr
                key={l.id}
                className={`border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors ${l.archived ? "opacity-40" : ""}`}
              >
                <td className="px-3 py-2.5 font-medium text-chanv-terre">
                  {l.id}
                  {l.nomSalle && <span className="text-slate-400 ml-1 text-xs">({l.nomSalle})</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: FAMILLE_COLORS[l.famille] || "#94a3b8" }}
                  />
                  <span className="text-xs">{l.famille}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{l.etage}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs truncate max-w-[200px]">{l.vocation}</td>
                <td className="px-3 py-2.5"><LocalStatusBadge status={l.statut} size="sm" /></td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{l.niveauAcces}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-xs text-slate-400 border-t border-chanv-fibre">
        {filtered.length} local{filtered.length > 1 ? "aux" : ""} affiché{filtered.length > 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ============================================================
// Actifs Table
// ============================================================

function AdminActifsTable({ actifs, search }: { actifs: Actif[]; search: string }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return actifs;
    const q = search.toLowerCase();
    return actifs.filter(
      (a) =>
        a.nom.toLowerCase().includes(q) ||
        a.matricule.toLowerCase().includes(q) ||
        a.categorie.toLowerCase().includes(q) ||
        a.idSalle.toLowerCase().includes(q)
    );
  }, [actifs, search]);

  if (filtered.length === 0) {
    return <EmptyState icon="🔧" title="Aucun actif" description="Aucun actif ne correspond aux critères." />;
  }

  return (
    <div className="section-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chanv-fibre text-left">
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Actif</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Local</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Catégorie</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Marque</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Criticité</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="font-medium text-chanv-terre text-xs">{a.nom}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{a.matricule}</div>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{a.idSalle || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{a.categorie || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{a.marque || "—"}</td>
                <td className="px-3 py-2.5 text-xs">
                  {a.criticite ? (
                    <span className={`badge text-[10px] ${
                      a.criticite === "Critique" ? "bg-red-100 text-red-700" :
                      a.criticite === "Majeur" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>{a.criticite}</span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{a.statut || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-xs text-slate-400 border-t border-chanv-fibre">
        {filtered.length} actif{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ============================================================
// Audit Log
// ============================================================

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "Création", color: "text-green-600 bg-green-100" },
  update: { label: "Modification", color: "text-blue-600 bg-blue-100" },
  delete: { label: "Suppression", color: "text-red-600 bg-red-100" },
  restore: { label: "Restauration", color: "text-purple-600 bg-purple-100" },
};

function AdminAuditLog({ logs, search }: { logs: AuditLogEntry[]; search: string }) {
  const filtered = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.targetName.toLowerCase().includes(q) ||
        l.user.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q)
    );
  }, [logs, search]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="Aucun log"
        description="Aucune action enregistrée pour le moment."
      />
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((log) => {
        const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "text-slate-600 bg-slate-100" };
        return (
          <div key={log.id} className="section-card p-3 flex items-start gap-3">
            <div className={`badge text-[10px] ${actionInfo.color} shrink-0 mt-0.5`}>
              {actionInfo.label}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-chanv-terre">
                <strong>{log.targetName}</strong>
                <span className="text-slate-400 ml-1">({log.target})</span>
              </div>
              {log.changes && (
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  {Object.entries(log.changes).map(([field, { before, after }]) => (
                    <div key={field}>
                      <span className="font-medium">{field}</span>: {before} → {after}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <User className="w-3 h-3" />
                {log.user}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                <Clock className="w-3 h-3" />
                {new Date(log.timestamp).toLocaleString("fr-CA")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
