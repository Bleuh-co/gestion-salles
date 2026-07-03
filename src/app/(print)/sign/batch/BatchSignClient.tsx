"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Printer, Search, ChevronDown, ChevronRight, CheckSquare, Square,
  Minus, ArrowLeft, Loader2, FileText, MapPin,
} from "lucide-react";
import { PrintableRoomSign } from "@/components/PrintableRoomSign";
import type { Local } from "@/lib/types";
import { FAMILLE_SHORT } from "@/lib/types";

// ============================================================
// Batch Sign Client
//
// Step 1: select rooms from a searchable, grouped list
// Step 2: preview & print all sign sheets (2 panels per page)
// ============================================================

interface Props {
  allLocaux: Local[];
  familleColors: Record<string, string>;
}

export function BatchSignClient({ allLocaux, familleColors }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState<"select" | "preview">("select");
  const [planRoomIds, setPlanRoomIds] = useState<string[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlFor = (id: string) => `${origin}/salles/${encodeURIComponent(id)}`;

  // ── Fetch plan room IDs on mount ──
  const fetchPlanRooms = useCallback(async () => {
    setLoadingPlan(true);
    try {
      // Get list of plans first
      const listRes = await fetch("/api/plan/list");
      if (!listRes.ok) return;
      const listData = await listRes.json();
      const plans: { id: string }[] = listData.plans || [];
      // Use saved plan or first
      const savedId = typeof window !== "undefined" ? localStorage.getItem("gs_plan_id") : null;
      const plan = plans.find((p) => p.id === savedId) || plans[0];
      if (!plan) return;

      // Get snapshot
      const snapRes = await fetch(`/api/plan/snapshot/${encodeURIComponent(plan.id)}`);
      if (!snapRes.ok) return;
      const snap = await snapRes.json();
      const positions: Record<string, unknown> = snap.room_positions || {};
      setPlanRoomIds(Object.keys(positions));
    } catch {
      // silently fail
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  useEffect(() => { fetchPlanRooms(); }, [fetchPlanRooms]);

  // ── Grouped & filtered rooms ──
  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? allLocaux.filter(
          (l) =>
            l.id.toLowerCase().includes(q) ||
            (l.nomSalle || "").toLowerCase().includes(q) ||
            (l.famille || "").toLowerCase().includes(q)
        )
      : allLocaux;

    const map = new Map<string, Local[]>();
    for (const l of filtered) {
      const fam = l.famille || "Autre";
      if (!map.has(fam)) map.set(fam, []);
      map.get(fam)!.push(l);
    }
    // Sort rooms within each famille
    for (const rooms of map.values()) {
      rooms.sort((a, b) => (a.nomSalle || a.id).localeCompare(b.nomSalle || b.id, "fr"));
    }
    return map;
  }, [allLocaux, search]);

  const families = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);

  // ── Selection helpers ──
  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFamille = (fam: string) => {
    const rooms = grouped.get(fam) || [];
    const allSelected = rooms.every((r) => selected.has(r.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        rooms.forEach((r) => next.delete(r.id));
      } else {
        rooms.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = allLocaux.map((l) => l.id);
    setSelected(new Set(allIds));
  };

  const selectNone = () => setSelected(new Set());

  const selectPlanRooms = () => {
    if (!planRoomIds) return;
    setSelected(new Set(planRoomIds));
  };

  // ── Build sign sheets from selected rooms ──
  const selectedLocaux = useMemo(() => {
    // Sort by famille then name for consistent ordering
    return allLocaux
      .filter((l) => selected.has(l.id))
      .sort((a, b) => {
        const famCmp = (a.famille || "").localeCompare(b.famille || "", "fr");
        if (famCmp !== 0) return famCmp;
        return (a.nomSalle || a.id).localeCompare(b.nomSalle || b.id, "fr");
      });
  }, [allLocaux, selected]);

  const sheets = useMemo(() => {
    const result: { left: Local; right: Local | null }[] = [];
    for (let i = 0; i < selectedLocaux.length; i += 2) {
      result.push({
        left: selectedLocaux[i],
        right: selectedLocaux[i + 1] || null,
      });
    }
    return result;
  }, [selectedLocaux]);

  const sheetCount = sheets.length;

  // ============================================================
  // STEP 1 — Selection
  // ============================================================
  if (step === "select") {
    return (
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "32px 20px",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#3d2e1c",
              margin: 0,
            }}
          >
            🖨️ Impression batch — Affiches de salles
          </h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>
            Sélectionnez les salles à imprimer. Chaque feuille contient 2 panneaux.
          </p>
        </div>

        {/* Stats bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            background: "#f8f5f0",
            borderRadius: 12,
            marginBottom: 16,
            flexWrap: "wrap",
            border: "1px solid #e8e0d4",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#3d2e1c",
            }}
          >
            {selected.size} salle{selected.size !== 1 ? "s" : ""} sélectionnée{selected.size !== 1 ? "s" : ""}
          </span>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>→</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            <FileText style={{ width: 14, height: 14, display: "inline", verticalAlign: "-2px", marginRight: 4 }} />
            {sheetCount} feuille{sheetCount !== 1 ? "s" : ""}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {planRoomIds && (
              <button
                onClick={selectPlanRooms}
                disabled={loadingPlan}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#3d2e1c",
                  background: "#fff",
                  border: "1px solid #d6cfc4",
                  borderRadius: 8,
                  padding: "5px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {loadingPlan ? (
                  <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                ) : (
                  <MapPin style={{ width: 12, height: 12 }} />
                )}
                Salles du plan ({planRoomIds.length})
              </button>
            )}
            <button
              onClick={selectAll}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "5px 8px",
              }}
            >
              Tout sélectionner
            </button>
            <button
              onClick={selectNone}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#64748b",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "5px 8px",
              }}
            >
              Tout désélectionner
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <Search
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 15,
              height: 15,
              color: "#94a3b8",
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une salle…"
            style={{
              width: "100%",
              padding: "10px 14px 10px 36px",
              fontSize: 13,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Room list grouped by famille */}
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            marginBottom: 20,
          }}
        >
          {families.length === 0 && (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              {search ? "Aucun résultat" : "Aucune salle disponible"}
            </div>
          )}

          {families.map((fam) => {
            const rooms = grouped.get(fam)!;
            const isCollapsed = collapsed[fam] ?? false;
            const color = familleColors[fam] || "#94a3b8";
            const allFamSelected = rooms.every((r) => selected.has(r.id));
            const someFamSelected = rooms.some((r) => selected.has(r.id));

            return (
              <div key={fam}>
                {/* Famille header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "#fafaf8",
                    borderBottom: "1px solid #f0ece4",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {/* Checkbox for entire famille */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFamille(fam);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      color: allFamSelected ? "#3d2e1c" : someFamSelected ? "#94a3b8" : "#cbd5e1",
                    }}
                  >
                    {allFamSelected ? (
                      <CheckSquare style={{ width: 16, height: 16 }} />
                    ) : someFamSelected ? (
                      <Minus style={{ width: 16, height: 16 }} />
                    ) : (
                      <Square style={{ width: 16, height: 16 }} />
                    )}
                  </button>

                  <div
                    onClick={() =>
                      setCollapsed((prev) => ({ ...prev, [fam]: !isCollapsed }))
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                      cursor: "pointer",
                    }}
                  >
                    {isCollapsed ? (
                      <ChevronRight style={{ width: 14, height: 14, color: "#94a3b8" }} />
                    ) : (
                      <ChevronDown style={{ width: 14, height: 14, color: "#94a3b8" }} />
                    )}
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        backgroundColor: color,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#475569",
                        flex: 1,
                      }}
                    >
                      {fam}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#94a3b8",
                        fontWeight: 500,
                      }}
                    >
                      {rooms.filter((r) => selected.has(r.id)).length}/{rooms.length}
                    </span>
                  </div>
                </div>

                {/* Room rows */}
                {!isCollapsed &&
                  rooms.map((room) => {
                    const isChecked = selected.has(room.id);
                    return (
                      <div
                        key={room.id}
                        onClick={() => toggle(room.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "7px 12px 7px 38px",
                          borderBottom: "1px solid #f5f3ef",
                          cursor: "pointer",
                          background: isChecked ? "#f0fdf4" : "transparent",
                          transition: "background 0.1s",
                        }}
                      >
                        <div
                          style={{
                            color: isChecked ? "#16a34a" : "#cbd5e1",
                            display: "flex",
                          }}
                        >
                          {isChecked ? (
                            <CheckSquare style={{ width: 15, height: 15 }} />
                          ) : (
                            <Square style={{ width: 15, height: 15 }} />
                          )}
                        </div>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            backgroundColor: color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: 7,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {FAMILLE_SHORT[room.famille] || "?"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#1e293b",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {room.nomSalle || room.id}
                          </div>
                          {room.nomSalle && (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#94a3b8",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {room.id}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>

        {/* Action button */}
        <button
          onClick={() => setStep("preview")}
          disabled={selected.size === 0}
          style={{
            width: "100%",
            padding: "14px 20px",
            fontSize: 15,
            fontWeight: 700,
            color: selected.size === 0 ? "#94a3b8" : "#fff",
            background: selected.size === 0 ? "#f1f5f9" : "#3d2e1c",
            border: "none",
            borderRadius: 12,
            cursor: selected.size === 0 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            transition: "all 0.15s",
          }}
        >
          <Printer style={{ width: 18, height: 18 }} />
          Générer les affiches ({selected.size} salle{selected.size !== 1 ? "s" : ""} → {sheetCount} feuille{sheetCount !== 1 ? "s" : ""})
        </button>
      </div>
    );
  }

  // ============================================================
  // STEP 2 — Preview & Print
  // ============================================================
  return (
    <>
      {/* Toolbar — hidden when printing */}
      <div
        className="sign-toolbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 12,
          maxWidth: "11in",
          margin: "0 auto",
          padding: "12px 16px",
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <button
          onClick={() => setStep("select")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#475569",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: 8,
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Modifier la sélection
        </button>

        <span
          style={{
            fontSize: 13,
            color: "#64748b",
            flex: 1,
          }}
        >
          {selectedLocaux.length} salle{selectedLocaux.length !== 1 ? "s" : ""} · {sheetCount} feuille{sheetCount !== 1 ? "s" : ""}
        </span>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            padding: "8px 20px",
            border: "none",
            borderRadius: 8,
            background: "#3d2e1c",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <Printer style={{ width: 16, height: 16 }} />
          Imprimer tout
        </button>
      </div>

      {/* Sign sheets */}
      {sheets.map((sheet, idx) => (
        <PrintableRoomSign
          key={`sheet-${idx}`}
          left={{ local: sheet.left, targetUrl: urlFor(sheet.left.id) }}
          right={
            sheet.right
              ? { local: sheet.right, targetUrl: urlFor(sheet.right.id) }
              : null
          }
        />
      ))}

      {/* Batch print styles — page-break between sheets */}
      <style>{`
        @media print {
          .sign-toolbar { display: none !important; }
          .sign-sheet {
            page-break-after: always;
            break-after: page;
          }
          .sign-sheet:last-of-type {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </>
  );
}
