"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Loader2 } from "lucide-react";
import type { Local } from "@/lib/types";
import { FAMILLE_COLORS, FAMILLE_SHORT } from "@/lib/types";

// ============================================================
// Portrait room sign — half of a US-Letter landscape sheet.
// Two panels print side-by-side on one landscape page.
//
// Each panel is divided into 3 equal rows:
//
//  ┌──────────────────────────┐
//  │          BADGE           │  ← Row 1: the letter
//  │        (letter)          │
//  ├────────────┬─────────────┤
//  │            │             │
//  │   QR code  │  Room name   │  ← Row 2: QR + name
//  │            │             │
//  ├────────────┴─────────────┤
//  │       Chanv logo         │  ← Row 3: logo
//  └──────────────────────────┘
// ============================================================

interface PanelSource {
  local: Local;
  targetUrl: string;
}

interface RoomSignProps {
  /** Left panel (always present). */
  left: PanelSource;
  /** Right panel — null renders a blank half (single sign). */
  right: PanelSource | null;
}

// ============================================================
// Single portrait panel (handles its own QR generation)
// ============================================================

function RoomPanel({ local, targetUrl }: PanelSource) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);

  const familleColor = FAMILLE_COLORS[local.famille] || "#94a3b8";
  const familleShort = FAMILLE_SHORT[local.famille] || local.idLicence || "?";
  const displayName = local.nomSalle || local.id;
  const isProd = local.prod;
  const badgeLetter = isProd ? "P" : familleShort.charAt(0);

  // Generate QR code (matrix redraw + centered Chanv icon)
  useEffect(() => {
    async function generate() {
      try {
        const source = sourceRef.current;
        const draw = drawRef.current;
        if (!source || !draw) return;

        await QRCode.toCanvas(source, targetUrl, {
          scale: 1, margin: 0,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "H",
        });

        const mc = source.width;
        const srcCtx = source.getContext("2d");
        if (!srcCtx) return;
        const imgData = srcCtx.getImageData(0, 0, mc, mc);

        const matrix: boolean[][] = [];
        for (let r = 0; r < mc; r++) {
          matrix[r] = [];
          for (let c = 0; c < mc; c++) {
            const idx = (r * mc + c) * 4;
            matrix[r][c] = imgData.data[idx] < 128;
          }
        }

        const quietZone = 4;
        const m = Math.max(8, Math.floor(600 / (mc + quietZone * 2)));
        const canvasSize = (mc + quietZone * 2) * m;
        const center = canvasSize / 2;
        const qrOx = quietZone * m;
        const qrOy = quietZone * m;

        draw.width = canvasSize;
        draw.height = canvasSize;
        const ctx = draw.getContext("2d");
        if (!ctx) return;

        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.fillStyle = "#242424";
        for (let row = 0; row < mc; row++) {
          for (let col = 0; col < mc; col++) {
            if (!matrix[row][col]) continue;
            ctx.fillRect(qrOx + col * m, qrOy + row * m, m, m);
          }
        }

        // Chanv icon in center
        const icon = new Image();
        icon.crossOrigin = "anonymous";
        icon.src = "/favicon.svg";
        icon.onload = () => {
          const logoR = canvasSize * 0.138;
          ctx.beginPath(); ctx.arc(center, center, logoR, 0, Math.PI * 2); ctx.fillStyle = "#FFFFFF"; ctx.fill();
          const iconSize = logoR * 1.8;
          ctx.drawImage(icon, center - iconSize / 2, center - iconSize / 2, iconSize, iconSize);
          setQrDataUrl(draw.toDataURL("image/png"));
        };
        icon.onerror = () => setQrDataUrl(draw.toDataURL("image/png"));
      } catch (err) { console.error("QR generation error:", err); }
    }
    generate();
  }, [targetUrl]);

  // Adaptive name font size (fixed inch units so screen == print)
  const len = displayName.length;
  const nameFontSize = len > 30 ? "0.4in" : len > 20 ? "0.55in" : len > 12 ? "0.72in" : "0.9in";

  return (
    <div
      className="room-panel"
      style={{
        flex: 1,
        minWidth: 0,
        height: "100%",
        background: "#4a4a4a",
        borderRadius: 10,
        boxSizing: "border-box",
        padding: "0.18in",
        display: "flex",
        flexDirection: "column",
        gap: "0.16in",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      <canvas ref={sourceRef} style={{ display: "none" }} />
      <canvas ref={drawRef} style={{ display: "none" }} />

      {/* ── Row 1 (25%): Famille badge (the letter) ── */}
      <div style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: familleColor,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize: "1.5in",
        fontWeight: 900,
        lineHeight: 1,
        overflow: "hidden",
      }}>
        {badgeLetter}
      </div>

      {/* ── Row 2 (50%): QR code, then room name, then id (stacked) ── */}
      <div style={{
        flex: 2,
        minHeight: 0,
        background: "#fff",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.18in",
        gap: "0.14in",
        overflow: "hidden",
        textAlign: "center",
      }}>
        {/* QR code (fixed size — independent of room-name length) */}
        <div style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR Code"
              style={{ width: "1.6in", height: "1.6in", objectFit: "contain" }}
            />
          ) : (
            <Loader2 style={{ width: 24, height: 24, color: "#94a3b8", animation: "spin 1s linear infinite" }} />
          )}
        </div>

        {/* Room name */}
        <div style={{
          fontSize: nameFontSize,
          fontWeight: 800,
          color: "#1a1a1a",
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          wordBreak: "break-word",
        }}>
          {displayName}
        </div>

        {/* Room id (smaller) */}
        {local.nomSalle && (
          <div style={{
            fontSize: "0.2in",
            fontWeight: 500,
            color: "#888",
            letterSpacing: "0.02em",
          }}>
            {local.id}
          </div>
        )}
      </div>

      {/* ── Row 3 (25%): Groupe Chanv logo (horizontal) ── */}
      <div style={{
        flex: 1,
        minHeight: 0,
        background: "#fff",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.26in 0.55in",
        overflow: "hidden",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-groupe-chanv.svg"
          alt="Groupe Chanv"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    </div>
  );
}

// ============================================================
// The sheet — US Letter landscape, two portrait panels
// ============================================================

export function PrintableRoomSign({ left, right }: RoomSignProps) {
  return (
    <>
      <div
        className="sign-sheet"
        style={{
          /* US Letter landscape */
          width: "11in",
          height: "8.5in",
          background: "#ffffff",
          margin: "40px auto",
          padding: "0.2in",
          display: "flex",
          alignItems: "stretch",
          gap: "0.2in",
          boxSizing: "border-box",
        }}
      >
        {/* Left panel */}
        <RoomPanel local={left.local} targetUrl={left.targetUrl} />

        {/* Cut guide */}
        <div
          className="cut-line"
          style={{ flex: "0 0 0", alignSelf: "stretch", borderLeft: "1px dashed #cbcbcb" }}
        />

        {/* Right panel (or blank half) */}
        {right ? (
          <RoomPanel local={right.local} targetUrl={right.targetUrl} />
        ) : (
          <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
        )}
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          @page {
            size: 11in 8.5in;
            margin: 0.2in;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            background-image: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sign-sheet {
            margin: 0 !important;
            padding: 0 !important;
            width: 10.6in !important;
            height: 8.1in !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .sign-toolbar { display: none !important; }
          /* Hide ALL external widgets */
          [data-feedback], [class*="feedback"],
          [data-gandalf], [class*="gandalf"],
          iframe, .intercom-lightweight-app,
          .crisp-client, #hubspot-messages-iframe-container,
          div[style*="z-index: 2147"], div[style*="z-index: 9999"] {
            display: none !important;
            visibility: hidden !important;
          }
        }
        @media screen {
          .sign-sheet {
            box-shadow: 0 8px 40px rgba(0,0,0,0.3);
            border-radius: 6px;
          }
        }
      `}</style>
    </>
  );
}
