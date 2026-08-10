"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useT, useLocale } from "@/lib/i18n";
import type { Local, Actif, AuditLogEntry, LocalFormOptions } from "@/lib/types";
import { FAMILLE_COLORS_FALLBACK } from "@/lib/types";
import { LocalStatusBadge } from "@/components/LocalStatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { LocalFormModal } from "@/components/LocalFormModal";
import { ActifFormModal, type ActifFormOptions } from "@/components/ActifFormModal";
import {
  Building, Wrench, ClipboardList, Search, Plus, Pencil, Trash2, RotateCcw,
  X, Save, Clock, User, Thermometer, Wifi, WifiOff,
  Link2, Unlink, RefreshCw, Loader2, Palette, Check
} from "lucide-react";

// ============================================================
// Admin Client
// ============================================================

interface AdminClientProps {
  locaux: Local[];
  actifs: Actif[];
  auditLogs: AuditLogEntry[];
  isSuperadmin: boolean;
  familleColors: Record<string, string>;
  formOptions: LocalFormOptions;
}

const ADMIN_TABS = [
  { key: "locaux", labelKey: "admin.tabLocaux", icon: Building },
  { key: "actifs", labelKey: "admin.tabActifs", icon: Wrench },
  { key: "capteurs", labelKey: "admin.tabCapteurs", icon: Thermometer },
  { key: "couleurs", labelKey: "admin.tabCouleurs", icon: Palette },
  { key: "logs", labelKey: "admin.tabLogs", icon: ClipboardList },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["key"];

export function AdminClient({
  locaux: initialLocaux,
  actifs,
  auditLogs,
  isSuperadmin,
  familleColors,
  formOptions,
}: AdminClientProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<AdminTab>("locaux");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  // Modales : undefined = fermé, null = création, objet = édition
  const [modalLocal, setModalLocal] = useState<Local | null | undefined>(undefined);
  const [modalActif, setModalActif] = useState<Actif | null | undefined>(undefined);

  // Options des dropdowns actifs, dérivées des valeurs en usage
  const actifOptions: ActifFormOptions = useMemo(() => {
    const uniq = (vals: string[]) =>
      [...new Set(vals.map((v) => v.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "fr")
      );
    return {
      categories: uniq(actifs.map((a) => a.categorie)),
      criticites: uniq([...actifs.map((a) => a.criticite), "Critique", "Majeur", "Mineur"]),
      statuts: uniq(actifs.map((a) => a.statut)),
    };
  }, [actifs]);

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-chanv-terre">{t("admin.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("admin.subtitle")}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-chanv-fibre" role="tablist">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count = tab.key === "locaux" ? initialLocaux.length :
            tab.key === "actifs" ? actifs.length :
            tab.key === "logs" ? auditLogs.length :
            undefined; // capteurs count loaded async
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
              {t(tab.labelKey)}
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
            placeholder={t("admin.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-chanv-fibre bg-white text-sm focus:outline-none focus:ring-2 focus:ring-chanv-beige/50"
          />
        </div>
        {activeTab === "locaux" && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded"
              />
              {t("admin.archived")}
            </label>
            <button
              onClick={() => setModalLocal(null)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-chanv-terre rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {t("admin.newRoom")}
            </button>
          </div>
        )}
        {activeTab === "actifs" && (
          <button
            onClick={() => setModalActif(null)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-chanv-terre rounded-xl hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {t("admin.newAsset")}
          </button>
        )}
      </div>

      {/* Modal création / édition salle */}
      {modalLocal !== undefined && (
        <LocalFormModal
          local={modalLocal}
          options={formOptions}
          familleColors={familleColors}
          onClose={() => setModalLocal(undefined)}
          onSaved={() => window.location.reload()}
        />
      )}

      {/* Modal création / édition actif */}
      {modalActif !== undefined && (
        <ActifFormModal
          actif={modalActif}
          salles={initialLocaux.filter((l) => !l.archived)}
          options={actifOptions}
          onClose={() => setModalActif(undefined)}
          onSaved={() => window.location.reload()}
        />
      )}

      {/* Content */}
      {activeTab === "locaux" && (
        <AdminLocauxTable
          locaux={initialLocaux}
          search={searchQuery}
          showArchived={showArchived}
          isSuperadmin={isSuperadmin}
          familleColors={familleColors}
          onEdit={(l) => setModalLocal(l)}
        />
      )}
      {activeTab === "actifs" && (
        <AdminActifsTable
          actifs={actifs}
          locaux={initialLocaux}
          search={searchQuery}
          onEdit={(a) => setModalActif(a)}
        />
      )}
      {activeTab === "capteurs" && (
        <AdminSensorsTab locaux={initialLocaux} search={searchQuery} />
      )}
      {activeTab === "couleurs" && (
        <AdminColorsTab />
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

function AdminLocauxTable({
  locaux,
  search,
  showArchived,
  isSuperadmin,
  familleColors,
  onEdit,
}: {
  locaux: Local[];
  search: string;
  showArchived: boolean;
  isSuperadmin: boolean;
  familleColors: Record<string, string>;
  onEdit: (l: Local) => void;
}) {
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const archiveLocal = async (l: Local, archive: boolean) => {
    const name = l.nomSalle || l.id;
    if (!confirm(archive ? t("admin.confirmArchive", { name }) : t("admin.confirmRestore", { name }))) return;
    setActionId(l.id);
    try {
      const res = await fetch(`/api/admin/locaux/${encodeURIComponent(l.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("admin.errorStatus", { status: res.status }));
      window.location.reload();
    } catch (e) {
      alert(`❌ ${e instanceof Error ? e.message : t("admin.error")}`);
      setActionId(null);
    }
  };

  const hardDelete = async (l: Local) => {
    if (!confirm(t("admin.confirmHardDelete", { name: l.nomSalle || l.id }))) return;
    if (!confirm(t("admin.confirmHardDeleteFinal", { id: l.id }))) return;
    setActionId(l.id);
    try {
      const res = await fetch(`/api/admin/locaux/${encodeURIComponent(l.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("admin.errorStatus", { status: res.status }));
      window.location.reload();
    } catch (e) {
      alert(`❌ ${e instanceof Error ? e.message : t("admin.error")}`);
      setActionId(null);
    }
  };

  const saveNomSalle = async (localId: string, value: string) => {
    setSavingId(localId);
    try {
      const res = await fetch("/api/admin/locaux-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ local_id: localId, field: "nomSalle", value }),
      });
      if (!res.ok) throw new Error("Erreur sauvegarde");
      // Update local state for instant feedback
      setLocalOverrides((prev) => ({ ...prev, [localId]: value }));
    } catch (e) {
      console.error("Save nomSalle failed", e);
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  };

  const getNomSalle = (l: Local): string => {
    // Local override takes precedence (just saved), then server-side data
    if (localOverrides[l.id] !== undefined) return localOverrides[l.id];
    return l.nomSalle || "";
  };

  const filtered = useMemo(() => {
    let result = locaux;
    if (!showArchived) result = result.filter((l) => !l.archived);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.id.toLowerCase().includes(q) ||
          getNomSalle(l).toLowerCase().includes(q) ||
          l.famille.toLowerCase().includes(q) ||
          l.vocation.toLowerCase().includes(q)
      );
    }
    return result;
  }, [locaux, search, showArchived, localOverrides]);

  if (filtered.length === 0) {
    return <EmptyState icon="🏢" title={t("admin.emptyLocauxTitle")} description={t("admin.emptyLocauxDesc")} />;
  }

  return (
    <div className="section-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chanv-fibre text-left">
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colId")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colNomSalle")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colFamille")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colEtage")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colVocation")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colStatut")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colAcces")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">{t("admin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const nomSalle = getNomSalle(l);
              return (
              <tr
                key={l.id}
                className={`border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors ${l.archived ? "opacity-40" : ""}`}
              >
                <td className="px-3 py-2.5 font-medium text-chanv-terre text-xs font-mono">
                  {l.id}
                </td>
                <td className="px-3 py-2.5">
                  {savingId === l.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-chanv-terre" />
                  ) : editingId === l.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveNomSalle(l.id, editValue);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="text-xs border border-chanv-terre/30 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-chanv-terre/30"
                        autoFocus
                        placeholder={t("admin.roomNamePlaceholder")}
                      />
                      <button
                        onClick={() => saveNomSalle(l.id, editValue)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title={t("admin.save")}
                      >
                        <Save className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                        title={t("admin.cancel")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-1 group cursor-pointer"
                      onClick={() => {
                        setEditingId(l.id);
                        setEditValue(nomSalle);
                      }}
                    >
                      <span className={`text-xs ${nomSalle ? "text-chanv-terre font-medium" : "text-slate-300 italic"}`}>
                        {nomSalle || "—"}
                      </span>
                      <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-1.5"
                    style={{ backgroundColor: familleColors[l.famille] || "#94a3b8" }}
                  />
                  <span className="text-xs">{l.famille}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-600 text-xs">{l.etage}</td>
                <td className="px-3 py-2.5 text-slate-600 text-xs truncate max-w-[200px]">{l.vocation}</td>
                <td className="px-3 py-2.5"><LocalStatusBadge status={l.statut} size="sm" /></td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{l.niveauAcces}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {actionId === l.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-chanv-terre" />
                    ) : (
                      <>
                        <button
                          onClick={() => onEdit(l)}
                          className="p-1.5 text-slate-400 hover:text-chanv-terre hover:bg-chanv-fibre/50 rounded-lg transition-colors"
                          title={t("admin.editRoom")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {l.archived ? (
                          <button
                            onClick={() => archiveLocal(l, false)}
                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title={t("admin.restore")}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => archiveLocal(l, true)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title={t("admin.archive")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isSuperadmin && l.archived && (
                          <button
                            onClick={() => hardDelete(l)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t("admin.hardDeleteTitle")}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-xs text-slate-400 border-t border-chanv-fibre">
        {filtered.length > 1
          ? t("admin.locauxShownPlural", { count: filtered.length })
          : t("admin.locauxShown", { count: filtered.length })}
      </div>
    </div>
  );
}

// ============================================================
// Actifs Table
// ============================================================

function AdminActifsTable({
  actifs,
  locaux,
  search,
  onEdit,
}: {
  actifs: Actif[];
  locaux: Local[];
  search: string;
  onEdit: (a: Actif) => void;
}) {
  const t = useT();
  const [actionId, setActionId] = useState<string | null>(null);
  const localIds = useMemo(() => new Set(locaux.map((l) => l.id)), [locaux]);

  const deleteActif = async (a: Actif) => {
    if (!confirm(t("admin.confirmDeleteActif", { name: a.nom || a.id }))) return;
    setActionId(a.id);
    try {
      const res = await fetch(`/api/admin/actifs/${encodeURIComponent(a.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("admin.errorStatus", { status: res.status }));
      window.location.reload();
    } catch (e) {
      alert(`❌ ${e instanceof Error ? e.message : t("admin.error")}`);
      setActionId(null);
    }
  };

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
    return <EmptyState icon="🔧" title={t("admin.emptyActifsTitle")} description={t("admin.emptyActifsDesc")} />;
  }

  return (
    <div className="section-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chanv-fibre text-left">
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colActif")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colLocal")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colCategorie")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colMarque")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colCriticite")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colStatut")}</th>
              <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right">{t("admin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="font-medium text-chanv-terre text-xs">{a.nom}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{a.matricule}</div>
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-600">
                  {a.idSalle ? (
                    localIds.has(a.idSalle) ? (
                      a.idSalle
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 text-amber-600"
                        title={t("admin.unknownRoomWarning")}
                      >
                        ⚠️ {a.idSalle}
                      </span>
                    )
                  ) : (
                    "—"
                  )}
                </td>
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
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {actionId === a.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-chanv-terre" />
                    ) : (
                      <>
                        <button
                          onClick={() => onEdit(a)}
                          className="p-1.5 text-slate-400 hover:text-chanv-terre hover:bg-chanv-fibre/50 rounded-lg transition-colors"
                          title={t("admin.editActif")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteActif(a)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t("admin.deleteActif")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-xs text-slate-400 border-t border-chanv-fibre">
        {filtered.length > 1
          ? t("admin.actifsShownPlural", { count: filtered.length })
          : t("admin.actifsShown", { count: filtered.length })}
      </div>
    </div>
  );
}

// ============================================================
// Audit Log
// ============================================================

const ACTION_LABELS: Record<string, { labelKey: string; color: string }> = {
  create: { labelKey: "admin.actionCreate", color: "text-green-600 bg-green-100" },
  update: { labelKey: "admin.actionUpdate", color: "text-blue-600 bg-blue-100" },
  delete: { labelKey: "admin.actionDelete", color: "text-red-600 bg-red-100" },
  restore: { labelKey: "admin.actionRestore", color: "text-purple-600 bg-purple-100" },
};

function AdminAuditLog({ logs, search }: { logs: AuditLogEntry[]; search: string }) {
  const t = useT();
  const locale = useLocale();
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
        title={t("admin.emptyLogsTitle")}
        description={t("admin.emptyLogsDesc")}
      />
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((log) => {
        const actionInfo = ACTION_LABELS[log.action];
        return (
          <div key={log.id} className="section-card p-3 flex items-start gap-3">
            <div className={`badge text-[10px] ${actionInfo?.color || "text-slate-600 bg-slate-100"} shrink-0 mt-0.5`}>
              {actionInfo ? t(actionInfo.labelKey) : log.action}
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
                {new Date(log.timestamp).toLocaleString(locale)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Sensors Tab (Capteurs)
// ============================================================

interface MappingEntry {
  sensor_id: string;
  sensor_name: string | null;
  matched_local_id: string | null;
  match_source: "auto" | "override" | "none";
  online: boolean;
  last_temp_c: number | null;
  last_humidity: number | null;
  battery: number | null;
  last_checkin_utc: string | null;
  provider?: string;
}

function AdminSensorsTab({ locaux, search }: { locaux: Local[]; search: string }) {
  const t = useT();
  const [mappings, setMappings] = useState<MappingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sensor-mapping");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("admin.errorStatus", { status: res.status }));
      }
      const data = await res.json();
      setMappings(data.mappings || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("admin.errorUnknown"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const handleOverride = async (sensorId: string, localId: string) => {
    setSavingId(sensorId);
    try {
      const res = await fetch("/api/admin/sensor-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensor_id: sensorId, local_id: localId }),
      });
      if (!res.ok) throw new Error("Erreur sauvegarde");
      await fetchMappings();
    } catch (e) {
      console.error("Override failed", e);
    } finally {
      setSavingId(null);
    }
  };

  const handleRemoveOverride = async (sensorId: string) => {
    setSavingId(sensorId);
    try {
      const res = await fetch("/api/admin/sensor-overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensor_id: sensorId }),
      });
      if (!res.ok) throw new Error("Erreur suppression");
      await fetchMappings();
    } catch (e) {
      console.error("Remove override failed", e);
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return mappings;
    const q = search.toLowerCase();
    return mappings.filter(
      (m) =>
        (m.sensor_name || "").toLowerCase().includes(q) ||
        m.sensor_id.toLowerCase().includes(q) ||
        (m.matched_local_id || "").toLowerCase().includes(q)
    );
  }, [mappings, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-card p-6 text-center space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={fetchMappings} className="btn-ghost text-xs flex items-center gap-1 mx-auto">
          <RefreshCw className="w-3 h-3" /> {t("admin.retry")}
        </button>
      </div>
    );
  }

  if (filtered.length === 0) {
    return <EmptyState icon="🌡️" title={t("admin.emptySensorsTitle")} description={search ? t("admin.noResults") : t("admin.emptySensorsDesc")} />;
  }

  const matched = mappings.filter((m) => m.match_source !== "none").length;
  const overrides = mappings.filter((m) => m.match_source === "override").length;
  const unmatched = mappings.filter((m) => m.match_source === "none").length;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <Link2 className="w-3.5 h-3.5 text-green-500" />
          <span className="text-slate-600">{matched > 1 ? t("admin.matchedCountPlural", { count: matched }) : t("admin.matchedCount", { count: matched })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Pencil className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-slate-600">{overrides > 1 ? t("admin.overrideCountPlural", { count: overrides }) : t("admin.overrideCount", { count: overrides })}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <Unlink className="w-3.5 h-3.5 text-red-400" />
          <span className="text-slate-600">{unmatched > 1 ? t("admin.unmatchedCountPlural", { count: unmatched }) : t("admin.unmatchedCount", { count: unmatched })}</span>
        </div>
        <button
          onClick={fetchMappings}
          className="ml-auto text-xs text-slate-400 hover:text-chanv-terre flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> {t("admin.refresh")}
        </button>
      </div>

      {/* Table */}
      <div className="section-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chanv-fibre text-left">
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colCapteur")}</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colSalleAssociee")}</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colSource")}</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colTemp")}</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colHumid")}</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colStatut")}</th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("admin.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.sensor_id} className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-chanv-terre text-xs">{m.sensor_name || t("admin.unnamedSensor")}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{m.sensor_id}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {savingId === m.sensor_id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-chanv-terre" />
                    ) : (
                      <select
                        value={m.matched_local_id || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleOverride(m.sensor_id, val);
                          } else if (m.match_source === "override") {
                            handleRemoveOverride(m.sensor_id);
                          }
                        }}
                        className="text-xs border border-chanv-fibre rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-chanv-terre/30 max-w-[180px]"
                      >
                        <option value="">{t("admin.notAssociated")}</option>
                        {locaux.map((l) => (
                          <option key={l.id} value={l.id}>{l.nomSalle || l.id}{l.nomSalle ? ` (${l.id})` : ""}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      m.match_source === "override" ? "bg-blue-100 text-blue-700" :
                      m.match_source === "auto" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-600"
                    }`}>
                      {m.match_source === "override" ? t("admin.sourceOverride") : m.match_source === "auto" ? t("admin.sourceAuto") : t("admin.sourceNone")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-rose-600">
                    {m.last_temp_c != null ? `${m.last_temp_c.toFixed(1)}°` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-blue-600">
                    {m.last_humidity != null ? `${Math.round(m.last_humidity)}%` : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      m.online ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                    }`}>
                      {m.online ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                      {m.online ? t("admin.online") : t("admin.offline")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {m.match_source === "override" && (
                      <button
                        onClick={() => handleRemoveOverride(m.sensor_id)}
                        className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1"
                        title={t("admin.removeOverrideTitle")}
                      >
                        <Trash2 className="w-3 h-3" /> {t("admin.remove")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 text-xs text-slate-400 border-t border-chanv-fibre">
          {filtered.length > 1
            ? t("admin.sensorsShownPlural", { count: filtered.length })
            : t("admin.sensorsShown", { count: filtered.length })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Colors Tab (Couleurs)
// ============================================================

function AdminColorsTab() {
  const t = useT();
  const [colors, setColors] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchColors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/famille-colors");
      if (!res.ok) throw new Error(t("admin.errorStatus", { status: res.status }));
      const data = await res.json();
      setColors(data.colors || FAMILLE_COLORS_FALLBACK);
      setOriginal(data.colors || FAMILLE_COLORS_FALLBACK);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("admin.errorUnknown"));
      setColors(FAMILLE_COLORS_FALLBACK);
      setOriginal(FAMILLE_COLORS_FALLBACK);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  const hasChanges = useMemo(() => {
    return Object.keys(colors).some((k) => colors[k] !== original[k]);
  }, [colors, original]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/admin/famille-colors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colors }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("admin.errorStatus", { status: res.status }));
      }
      setOriginal({ ...colors });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("admin.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setColors({ ...original });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-chanv-terre" />
      </div>
    );
  }

  const familles = Object.keys(colors);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">
            {t("admin.colorsHelp")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {t("admin.cancel")}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg transition-all ${
              saved
                ? "bg-green-500 text-white"
                : hasChanges
                ? "bg-chanv-terre text-white hover:bg-chanv-terre/90 shadow-sm"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? t("admin.saving") : saved ? t("admin.savedSuccess") : t("admin.save")}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Color Grid */}
      <div className="section-card overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
          {familles.map((famille, i) => {
            const color = colors[famille];
            const changed = color !== original[famille];
            return (
              <div
                key={famille}
                className={`flex items-center gap-3 px-4 py-3 border-b border-chanv-fibre/50 ${
                  i % 3 < 2 ? "sm:border-r" : ""
                } ${changed ? "bg-amber-50/50" : "hover:bg-chanv-fibre/20"} transition-colors`}
              >
                {/* Color swatch + picker */}
                <label className="relative cursor-pointer group">
                  <div
                    className="w-8 h-8 rounded-lg border-2 border-white shadow-md transition-transform group-hover:scale-110"
                    style={{ backgroundColor: color }}
                  />
                  <input
                    type="color"
                    value={color}
                    onChange={(e) =>
                      setColors((prev) => ({ ...prev, [famille]: e.target.value }))
                    }
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title={t("admin.changeColorOf", { famille })}
                  />
                </label>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-chanv-terre truncate">
                    {famille}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {color}
                    {changed && (
                      <span className="ml-1.5 text-amber-600 font-sans font-medium">
                        {t("admin.modified")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Preview badge */}
                <div
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {famille.length > 8 ? famille.slice(0, 8) + "…" : famille}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
