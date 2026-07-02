"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { PrintableRoomSign } from "@/components/PrintableRoomSign";
import type { Local } from "@/lib/types";

const BLANK = "__blank__";

export function SignPageClient({ local, allLocaux }: { local: Local; allLocaux: Local[] }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlFor = (id: string) => `${origin}/salles/${encodeURIComponent(id)}`;

  // Right panel: defaults to a duplicate of the current room.
  const [rightId, setRightId] = useState<string>(local.id);

  const options = useMemo(
    () =>
      [...allLocaux].sort((a, b) =>
        (a.nomSalle || a.id).localeCompare(b.nomSalle || b.id, "fr")
      ),
    [allLocaux]
  );

  const rightLocal =
    rightId === BLANK ? null : allLocaux.find((l) => l.id === rightId) || local;

  const left = { local, targetUrl: urlFor(local.id) };
  const right = rightLocal
    ? { local: rightLocal, targetUrl: urlFor(rightLocal.id) }
    : null;

  return (
    <>
      {/* Toolbar — screen only, hidden when printing */}
      <div
        className="sign-toolbar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          maxWidth: "11in",
          margin: "24px auto 0",
          padding: "12px 16px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>
          Panneau gauche&nbsp;:
        </span>
        <span style={{ fontSize: 14, color: "#475569" }}>
          {local.nomSalle || local.id}
        </span>

        <span style={{ width: 1, height: 22, background: "#e5e7eb", margin: "0 4px" }} />

        <label htmlFor="right-panel" style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a" }}>
          Panneau droit&nbsp;:
        </label>
        <select
          id="right-panel"
          value={rightId}
          onChange={(e) => setRightId(e.target.value)}
          style={{
            fontSize: 14,
            padding: "6px 10px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            background: "#fff",
            color: "#1a1a1a",
            maxWidth: 320,
          }}
        >
          <option value={local.id}>
            {(local.nomSalle || local.id)} (même salle)
          </option>
          <option value={BLANK}>— Panneau vide —</option>
          <optgroup label="Autre salle">
            {options
              .filter((l) => l.id !== local.id)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nomSalle ? `${l.nomSalle} (${l.id})` : l.id}
                </option>
              ))}
          </optgroup>
        </select>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            padding: "8px 16px",
            border: "none",
            borderRadius: 8,
            background: "#1a1a1a",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <Printer style={{ width: 16, height: 16 }} />
          Imprimer
        </button>
      </div>

      <PrintableRoomSign left={left} right={right} />
    </>
  );
}
