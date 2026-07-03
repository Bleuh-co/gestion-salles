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
          color: { dark: "#1c1917", light: "#f5f0e8" },
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

        ctx.fillStyle = "#f5f0e8";
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        ctx.fillStyle = "#1c1917";
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
          ctx.beginPath(); ctx.arc(center, center, logoR, 0, Math.PI * 2); ctx.fillStyle = "#f5f0e8"; ctx.fill();
          const iconSize = logoR * 1.8;
          ctx.drawImage(icon, center - iconSize / 2, center - iconSize / 2, iconSize, iconSize);
          setQrDataUrl(draw.toDataURL("image/png"));
        };
        icon.onerror = () => setQrDataUrl(draw.toDataURL("image/png"));
      } catch (err) { console.error("QR generation error:", err); }
    }
    generate();
  }, [targetUrl]);

  // Adaptive name font size — proportional word-wrap simulation.
  // We simulate word-wrap to find the largest font that fits both
  // horizontally (longest word on one line) and vertically (all lines
  // in the 1.5in slot).
  const nameFontSize = (() => {
    const words = displayName.split(/\s+/);
    const longestWordLen = words.reduce((m, w) => Math.max(m, w.length), 0);
    // Panel text area width ≈ 4.4in, avg char width ≈ 0.65 × fontSize
    // (conservative to handle uppercase-heavy names like TERRAIN_HQ)
    // Exception: words with "/" use 0.58 since "/" is narrow (only affects
    // "Réception/Expédition Chanv" — no other name has "/")
    const AW = 4.4, CW = 0.65, SH = 1.5, LH = 1.12;
    const longestWordCW = words.reduce((best, w) => {
      const cw = w.includes("/") ? 0.58 : CW;
      const width = w.length * cw;
      return width > best.width ? { width, len: w.length, cw } : best;
    }, { width: 0, len: 0, cw: CW });
    for (let f = 0.85; f >= 0.28; f -= 0.01) {
      // Check: does the widest word fit on one line?
      if (longestWordCW.len * longestWordCW.cw * f > AW) continue;
      // Simulate word wrap (uses CW=0.65 for all line-width calculations)
      const cpl = Math.floor(AW / (CW * f));
      let lines = 1, ll = 0;
      for (const w of words) {
        if (ll === 0) { ll = w.length; }
        else if (ll + 1 + w.length <= cpl) { ll += 1 + w.length; }
        else { lines++; ll = w.length; }
      }
      if (lines * f * LH <= SH) return `${f.toFixed(2)}in`;
    }
    return "0.28in";
  })();

  return (
    <div
      className="room-panel"
      style={{
        flex: 1,
        minWidth: 0,
        height: "100%",
        background: "#1c1917",
        borderRadius: 10,
        boxSizing: "border-box",
        padding: "0.18in",
        display: "flex",
        flexDirection: "column",
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
        borderRadius: "8px 8px 0 0",
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

      {/* ── Gandalf diagonal — badge color slants into beige ── */}
      <svg
        viewBox="0 0 200 20"
        preserveAspectRatio="none"
        style={{
          width: "100%",
          height: "0.22in",
          flexShrink: 0,
          display: "block",
        }}
      >
        <rect width="200" height="20" fill="#f5f0e8" />
        <polygon points="0,0 200,0 200,5 0,20" fill={familleColor} />
      </svg>

      {/* ── Row 2 (50%): QR, name, id — fixed-height slots so the ── */}
      {/* ── layout never shifts with content length             ── */}
      <div style={{
        flex: 2,
        minHeight: 0,
        background: "#f5f0e8",
        borderRadius: "0 0 8px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.14in",
        overflow: "hidden",
        textAlign: "center",
      }}>
        {/* QR code — fixed size */}
        <div style={{
          flexShrink: 0,
          height: "1.45in",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR Code"
              style={{ width: "1.45in", height: "1.45in", objectFit: "contain" }}
            />
          ) : (
            <Loader2 style={{ width: 24, height: 24, color: "#94a3b8", animation: "spin 1s linear infinite" }} />
          )}
        </div>

        {/* Room name — fixed-height slot, text vertically centered */}
        <div style={{
          flexShrink: 0,
          height: "1.5in",
          marginTop: "0.1in",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "visible",
          position: "relative",
          zIndex: 2,
        }}>
          <div style={{
            fontSize: nameFontSize,
            fontWeight: 800,
            color: "#1c1917",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            overflowWrap: "break-word",
          }}>
            {displayName}
          </div>
        </div>

        {/* Room id — fixed-height slot, always reserved (empty if none) */}
        <div style={{
          flexShrink: 0,
          height: "0.3in",
          marginTop: "0.04in",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {local.nomSalle && (
            <div style={{
              fontSize: "0.2in",
              fontWeight: 500,
              color: "#8c7e6a",
              letterSpacing: "0.02em",
            }}>
              {local.id}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3 (25%): Groupe Chanv logo (horizontal) ── */}
      <div style={{
        flex: 1,
        minHeight: 0,
        marginTop: "0.16in",
        background: "#f5f0e8",
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
