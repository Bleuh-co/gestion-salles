"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { Local } from "@/lib/types";
import { FAMILLE_COLORS, FAMILLE_SHORT } from "@/lib/types";
import { LocalStatusBadge } from "./LocalStatusBadge";
import {
  ZoomIn, ZoomOut, RotateCcw, RefreshCw, Loader2, Maximize2, X,
  Thermometer, Building, Layers, Shield, QrCode, GripVertical, Save,
  Plus, EyeOff, ChevronDown, ChevronRight, Search
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface PlanInfo {
  id: string;
  name: string;
  has_image: boolean;
  sensor_count: number;
  room_count: number;
}

interface Snapshot {
  plan_id: string;
  plan_name: string;
  image_url: string | null;
  room_positions: Record<string, { x: number; y: number }>;
}

interface FloorPlanViewProps {
  locaux: Local[];
  isAdmin?: boolean;
}

// No auto-layout — only placed rooms appear on the plan.
// Unplaced rooms are shown in the tray panel during edit mode.



// ============================================================
// Component
// ============================================================

const MIN_SCALE = 0.05;
const MAX_SCALE = 6;

export function FloorPlanView({ locaux, isAdmin = false }: FloorPlanViewProps) {
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [roomPositions, setRoomPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [editMode, setEditMode] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pan / Zoom
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; stx: number; sty: number } | null>(null);
  const markerDragRef = useRef<{ roomId: string } | null>(null);

  // ---- Load plans list ----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/plan/list");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        const list: PlanInfo[] = data.plans || [];
        setPlans(list);
        const saved = typeof window !== "undefined" ? localStorage.getItem("gs_plan_id") : null;
        const initial = list.find((p) => p.id === saved) || list[0];
        if (initial) {
          setCurrentPlanId(initial.id);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable ref for locaux (avoids recreating loadSnapshot on every render)
  const locauxRef = useRef(locaux);
  locauxRef.current = locaux;

  // ---- Load snapshot ----
  const loadSnapshot = useCallback(
    async (planId: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/plan/snapshot/${encodeURIComponent(planId)}`);
        if (!res.ok) throw new Error("Failed");
        const data: Snapshot = await res.json();
        setSnapshot(data);
        setRoomPositions(data.room_positions || {});
      } catch {
        setRoomPositions({});
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (currentPlanId) {
      if (typeof window !== "undefined") localStorage.setItem("gs_plan_id", currentPlanId);
      loadSnapshot(currentPlanId);
    }
  }, [currentPlanId, loadSnapshot]);

  // ---- Fit to stage ----
  const fitToStage = useCallback(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage) return;

    if (img && img.naturalWidth) {
      const sW = stage.clientWidth;
      const sH = stage.clientHeight;
      const iW = img.naturalWidth;
      const iH = img.naturalHeight;
      const s = Math.min(sW / iW, sH / iH) * 0.95;
      const newScale = Math.max(MIN_SCALE, s);
      setScale(newScale);
      setTx((sW - iW * newScale) / 2);
      setTy((sH - iH * newScale) / 2);
    } else {
      // No image — use stage dimensions for the virtual canvas
      setScale(1);
      setTx(0);
      setTy(0);
    }
  }, []);

  // ---- Zoom ----
  const zoomBy = useCallback((k: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setScale((prev) => {
      const newS = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * k));
      const r = newS / prev;
      setTx((ptx) => cx - (cx - ptx) * r);
      setTy((pty) => cy - (cy - pty) * r);
      return newS;
    });
  }, []);

  // ---- Wheel zoom ----
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = -e.deltaY * 0.0015;
      setScale((prev) => {
        const newS = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * (1 + delta)));
        const k = newS / prev;
        setTx((ptx) => cx - (cx - ptx) * k);
        setTy((pty) => cy - (cy - pty) * k);
        return newS;
      });
    };
    stage.addEventListener("wheel", handler, { passive: false });
    return () => stage.removeEventListener("wheel", handler);
  }, []);

  // ---- Pan (left-click normal mode, right-click in edit mode) ----
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // In edit mode, only right-click (button=2) pans
      if (editMode && e.button !== 2) return;
      // In normal mode, left-click pans (skip if clicking a marker/card)
      if (!editMode && (e.target as HTMLElement).closest(".plan-marker, .plan-room-card")) return;
      dragRef.current = { sx: e.clientX, sy: e.clientY, stx: tx, sty: ty };
    },
    [tx, ty, editMode]
  );

  // Prevent context menu on the stage (so right-click pan works)
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Marker drag in edit mode
      if (markerDragRef.current) {
        const stage = stageRef.current;
        if (!stage) return;

        const canvas = stage.querySelector("[data-plan-canvas]") as HTMLElement;
        if (!canvas) return;
        const canvasRect = canvas.getBoundingClientRect();

        const xRel = (e.clientX - canvasRect.left) / canvasRect.width;
        const yRel = (e.clientY - canvasRect.top) / canvasRect.height;
        const x = Math.max(0.02, Math.min(0.98, xRel));
        const y = Math.max(0.02, Math.min(0.98, yRel));

        // Capture roomId NOW, before async setState callback
        const roomId = markerDragRef.current.roomId;
        setRoomPositions((prev) => ({
          ...prev,
          [roomId]: { x, y },
        }));
        setDirty(true);
        return;
      }

      // Pan drag
      if (!dragRef.current) return;
      setTx(dragRef.current.stx + (e.clientX - dragRef.current.sx));
      setTy(dragRef.current.sty + (e.clientY - dragRef.current.sy));
    };
    const onUp = () => {
      dragRef.current = null;
      markerDragRef.current = null;
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ---- Save positions ----
  const savePositions = useCallback(async () => {
    if (!currentPlanId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/plan/${encodeURIComponent(currentPlanId)}/room-positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_positions: roomPositions }),
      });
      if (!res.ok) throw new Error("Échec sauvegarde");
      setDirty(false);
      setEditMode(false);
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  }, [currentPlanId, roomPositions]);

  // ---- Room helpers ----
  const locauxMap = new Map(locaux.map((l) => [l.id, l]));
  const selectedLocal = selectedRoom ? locauxMap.get(selectedRoom) : null;
  const placedCount = Object.keys(roomPositions).length;
  const unplacedRooms = locaux.filter((l) => !roomPositions[l.id]);

  // ---- Add / remove room from plan ----
  const addRoomToPlan = useCallback((roomId: string) => {
    // Place at center of the current viewport
    const stage = stageRef.current;
    let x = 0.5, y = 0.5;
    if (stage) {
      const rect = stage.getBoundingClientRect();
      // Convert viewport center to plan coordinates
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      // Get canvas element
      const canvas = stage.querySelector("[data-plan-canvas]") as HTMLElement;
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        x = Math.max(0.02, Math.min(0.98, (centerX - canvasRect.left) / canvasRect.width));
        y = Math.max(0.02, Math.min(0.98, (centerY - canvasRect.top) / canvasRect.height));
      }
    }
    setRoomPositions((prev) => ({ ...prev, [roomId]: { x, y } }));
    setDirty(true);
  }, []);

  const removeRoomFromPlan = useCallback((roomId: string) => {
    setRoomPositions((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    setDirty(true);
  }, []);

  // ---- Tray state ----
  const [traySearch, setTraySearch] = useState("");
  const [trayCollapsed, setTrayCollapsed] = useState<Record<string, boolean>>({});

  // ---- Virtual canvas size (when no plan image) ----
  const canvasW = snapshot?.image_url ? undefined : 1200;
  const canvasH = snapshot?.image_url ? undefined : 800;

  return (
    <div className="card overflow-hidden">
      {/* Plan tabs */}
      {plans.length > 1 && (
        <div className="flex gap-1 px-4 pt-2 bg-chanv-fibre/30 border-b border-chanv-fibre overflow-x-auto">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setCurrentPlanId(p.id);
                setSelectedRoom(null);
                setEditMode(false);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all ${
                p.id === currentPlanId
                  ? "bg-white text-chanv-terre border border-chanv-fibre border-b-white -mb-px"
                  : "text-slate-500 hover:text-chanv-terre"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-chanv-fibre/20 border-b border-chanv-fibre gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button onClick={() => zoomBy(1.25)} className="plan-ctrl-btn" title="Zoom +"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => zoomBy(1 / 1.25)} className="plan-ctrl-btn" title="Zoom -"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-slate-500 font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={fitToStage} className="plan-ctrl-btn" title="Recentrer"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={() => currentPlanId && loadSnapshot(currentPlanId)} className="plan-ctrl-btn" title="Rafraîchir"><RefreshCw className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">
            {placedCount} salle{placedCount !== 1 ? "s" : ""} placée{placedCount !== 1 ? "s" : ""}
            {unplacedRooms.length > 0 && (
              <> · {unplacedRooms.length} non placée{unplacedRooms.length !== 1 ? "s" : ""}</>
            )}
          </span>

          {isAdmin && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="plan-ctrl-btn !w-auto px-3 gap-1.5 text-xs"
              title="Repositionner les salles"
            >
              <GripVertical className="w-3.5 h-3.5" /> Éditer
            </button>
          )}
          {editMode && (
            <>
              <button
                onClick={savePositions}
                disabled={saving || !dirty}
                className="plan-ctrl-btn !w-auto px-3 gap-1.5 text-xs !bg-chanv-terre !text-white !border-chanv-terre disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "…" : "Sauvegarder"}
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  if (currentPlanId) loadSnapshot(currentPlanId);
                }}
                className="plan-ctrl-btn !w-auto px-3 text-xs"
              >
                Annuler
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 font-medium">
          ✏️ Mode édition — Glisse les salles · Clic droit pour naviguer · ✕ pour retirer · Panneau latéral pour ajouter
        </div>
      )}

      {/* Stage + Tray layout */}
      <div className="flex" style={{ height: "70vh", minHeight: 500 }}>
        {/* Tray panel — unplaced rooms (edit mode only) */}
        {editMode && (
          <RoomTray
            unplacedRooms={unplacedRooms}
            traySearch={traySearch}
            setTraySearch={setTraySearch}
            trayCollapsed={trayCollapsed}
            setTrayCollapsed={setTrayCollapsed}
            onAdd={addRoomToPlan}
          />
        )}

        {/* Map stage */}
        <div
          ref={stageRef}
          className="relative flex-1 overflow-hidden select-none"
          style={{
            cursor: editMode ? "default" : dragRef.current ? "grabbing" : "grab",
            background:
              "linear-gradient(45deg, #f8f8f8 25%, transparent 25%), linear-gradient(-45deg, #f8f8f8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f8f8f8 75%), linear-gradient(-45deg, transparent 75%, #f8f8f8 75%)",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, 10px 0px",
          }}
          onMouseDown={onMouseDown}
          onContextMenu={onContextMenu}
        >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-30">
            <Loader2 className="w-8 h-8 animate-spin text-chanv-terre" />
          </div>
        )}

        {/* Canvas (transformed) */}
        <div
          data-plan-canvas
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            width: canvasW,
            height: canvasH,
          }}
        >
          {/* Plan image */}
          {snapshot?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={snapshot.image_url}
              alt="Plan"
              style={{ display: "block", maxWidth: "none", pointerEvents: "none", userSelect: "none" }}
              onLoad={fitToStage}
            />
          ) : (
            /* Virtual canvas background when no plan image */
            <div
              style={{
                width: canvasW,
                height: canvasH,
                background: "linear-gradient(135deg, #fafaf8 0%, #f5f0e8 100%)",
                border: "2px dashed #ddd",
                borderRadius: 12,
              }}
            />
          )}

          {/* Markers container */}
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>

            {/* ROOM markers */}
            {Object.entries(roomPositions).map(([roomId, pos]) => {
              const local = locauxMap.get(roomId);
              if (!local) return null;
              const color = FAMILLE_COLORS[local.famille] || "#94a3b8";
              const short = FAMILLE_SHORT[local.famille] || "?";
              const isSelected = selectedRoom === roomId;

              return (
                <div
                  key={`room-${roomId}`}
                  className="plan-marker"
                  onMouseDown={(e) => {
                    if (editMode && e.button === 0) {
                      e.preventDefault();
                      e.stopPropagation();
                      markerDragRef.current = { roomId };
                    }
                  }}
                  onClick={(e) => {
                    if (editMode) return;
                    e.stopPropagation();
                    setSelectedRoom(isSelected ? null : roomId);
                  }}
                  style={{
                    position: "absolute",
                    left: `${(pos.x * 100).toFixed(2)}%`,
                    top: `${(pos.y * 100).toFixed(2)}%`,
                    transform: `translate(-50%, -50%) scale(${Math.max(0.5, Math.min(3, 1 / scale))})`,
                    transformOrigin: "center center",
                    pointerEvents: "auto",
                    cursor: editMode ? "grab" : "pointer",
                    zIndex: isSelected ? 10 : 3,
                  }}
                >
                  {/* Remove button (edit mode) */}
                  {editMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRoomFromPlan(roomId);
                      }}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#EF4444",
                        border: "2px solid white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        zIndex: 20,
                        padding: 0,
                        lineHeight: 1,
                      }}
                      title="Retirer du plan"
                    >
                      <X style={{ width: 10, height: 10, color: "white" }} />
                    </button>
                  )}
                  {/* Room square */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: color,
                      border: isSelected ? "3px solid #fff" : "2px solid rgba(255,255,255,0.85)",
                      boxShadow: isSelected
                        ? `0 0 0 3px ${color}, 0 4px 20px rgba(0,0,0,0.35)`
                        : "0 2px 10px rgba(0,0,0,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: -0.3,
                      transition: "box-shadow 0.15s",
                    }}
                  >
                    {short}
                  </div>
                  {/* Room name */}
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 3px)",
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(255,255,255,0.95)",
                      color: "#333",
                      padding: "2px 7px",
                      borderRadius: 5,
                      fontSize: 9,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                      pointerEvents: "none",
                      maxWidth: 110,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    {local.id}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected room card */}
        {selectedLocal && !editMode && (
          <div
            className="plan-room-card absolute z-20 top-4 right-4 w-80 bg-white rounded-2xl shadow-2xl border border-chanv-fibre overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 p-4 border-b border-chanv-fibre">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: FAMILLE_COLORS[selectedLocal.famille] || "#94a3b8" }}
              >
                {FAMILLE_SHORT[selectedLocal.famille] || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-chanv-terre text-sm truncate">{selectedLocal.id}</h3>
                {selectedLocal.nomSalle && (
                  <p className="text-[11px] text-slate-400 truncate">{selectedLocal.nomSalle}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedRoom(null)}
                className="p-1 hover:bg-chanv-fibre rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <LocalStatusBadge status={selectedLocal.statut} size="sm" />
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-chanv-fibre text-slate-600 font-semibold">
                  {selectedLocal.famille}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{selectedLocal.vocation || "—"}</p>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Building className="w-3 h-3" /> {selectedLocal.batiment}
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Layers className="w-3 h-3" /> {selectedLocal.etage}
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Thermometer className="w-3 h-3" /> {selectedLocal.conditions || "—"}
                </div>
                {selectedLocal.niveauAcces !== "Employés" && (
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Shield className="w-3 h-3" /> {selectedLocal.niveauAcces}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 p-4 pt-0">
              <Link
                href={`/salles/${encodeURIComponent(selectedLocal.id)}`}
                className="btn-primary flex-1 flex items-center justify-center gap-2 text-xs py-2"
              >
                <Maximize2 className="w-3 h-3" />
                Voir détails
              </Link>
              <Link
                href={`/salles/${encodeURIComponent(selectedLocal.id)}/qr`}
                className="btn-ghost border border-chanv-fibre flex items-center justify-center gap-1.5 text-xs py-2 px-3 rounded-xl"
                target="_blank"
              >
                <QrCode className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-chanv-fibre bg-chanv-fibre/10 overflow-x-auto">
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider shrink-0">Légende</span>
        {Object.entries(FAMILLE_COLORS).map(([fam, color]) => (
          <div key={fam} className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-slate-500 font-medium">{fam}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Room Tray — sidebar panel listing unplaced rooms
// ============================================================

function RoomTray({
  unplacedRooms,
  traySearch,
  setTraySearch,
  trayCollapsed,
  setTrayCollapsed,
  onAdd,
}: {
  unplacedRooms: Local[];
  traySearch: string;
  setTraySearch: (s: string) => void;
  trayCollapsed: Record<string, boolean>;
  setTrayCollapsed: (c: Record<string, boolean>) => void;
  onAdd: (roomId: string) => void;
}) {
  // Filter by search
  const search = traySearch.toLowerCase().trim();
  const filtered = search
    ? unplacedRooms.filter(
        (l) =>
          l.id.toLowerCase().includes(search) ||
          (l.nomSalle || "").toLowerCase().includes(search) ||
          (l.famille || "").toLowerCase().includes(search)
      )
    : unplacedRooms;

  // Group by famille
  const grouped = new Map<string, Local[]>();
  for (const l of filtered) {
    const fam = l.famille || "Autre";
    if (!grouped.has(fam)) grouped.set(fam, []);
    grouped.get(fam)!.push(l);
  }
  const families = Array.from(grouped.keys()).sort();

  return (
    <div
      className="border-r border-chanv-fibre bg-white flex flex-col"
      style={{ width: 260, minWidth: 260 }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-chanv-fibre bg-chanv-fibre/20">
        <div className="flex items-center gap-2 mb-2">
          <EyeOff className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-chanv-terre">Salles à placer</span>
          <span className="ml-auto text-[10px] bg-chanv-fibre text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">
            {unplacedRooms.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
          <input
            type="text"
            value={traySearch}
            onChange={(e) => setTraySearch(e.target.value)}
            placeholder="Rechercher…"
            className="w-full text-xs pl-7 pr-2 py-1.5 rounded-lg border border-chanv-fibre bg-white focus:outline-none focus:ring-1 focus:ring-chanv-terre/30"
          />
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto">
        {families.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            {search ? "Aucun résultat" : "Toutes les salles sont placées ✓"}
          </div>
        )}
        {families.map((fam) => {
          const rooms = grouped.get(fam)!;
          const isCollapsed = trayCollapsed[fam] ?? false;
          const color = FAMILLE_COLORS[fam] || "#94a3b8";

          return (
            <div key={fam}>
              <button
                onClick={() =>
                  setTrayCollapsed({ ...trayCollapsed, [fam]: !isCollapsed })
                }
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-chanv-fibre/30 transition-colors border-b border-chanv-fibre/50"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                )}
                <div
                  className="w-2.5 h-2.5 rounded"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 text-left">{fam}</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {rooms.length}
                </span>
              </button>
              {!isCollapsed && (
                <div>
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-emerald-50 transition-colors group cursor-pointer border-b border-chanv-fibre/20"
                      onClick={() => onAdd(room.id)}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0"
                        style={{
                          backgroundColor: color,
                          fontSize: 7,
                          fontWeight: 800,
                        }}
                      >
                        {FAMILLE_SHORT[room.famille] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-slate-700 truncate">
                          {room.id}
                        </div>
                        {room.nomSalle && (
                          <div className="text-[9px] text-slate-400 truncate">
                            {room.nomSalle}
                          </div>
                        )}
                      </div>
                      <Plus className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
