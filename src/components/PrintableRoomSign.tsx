"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Printer, Loader2, ArrowLeft } from "lucide-react";
import type { Local } from "@/lib/types";
import { FAMILLE_COLORS, FAMILLE_SHORT } from "@/lib/types";

// ============================================================
// Safety pictograms per famille
// ============================================================

interface SafetyItem {
  icon: string;
  label: string;
}

const SAFETY_ITEMS: Record<string, SafetyItem[]> = {
  CANNABIS: [
    { icon: "🥾", label: "Porter des bottes de sécurité" },
    { icon: "🧢", label: "Porter un filet à cheveux / filet à barbe si nécessaire" },
    { icon: "🥼", label: "Porter un sarot" },
    { icon: "❌", label: "Aucun bijoux" },
  ],
  PSN: [
    { icon: "🥾", label: "Porter des bottes de sécurité" },
    { icon: "🧢", label: "Porter un filet à cheveux / filet à barbe si nécessaire" },
    { icon: "🥼", label: "Porter un sarot" },
    { icon: "❌", label: "Aucun bijoux" },
  ],
  ALI: [
    { icon: "🥾", label: "Porter des bottes de sécurité" },
    { icon: "🧢", label: "Porter un filet à cheveux / filet à barbe si nécessaire" },
    { icon: "🥼", label: "Porter un sarot" },
    { icon: "❌", label: "Aucun bijoux" },
  ],
  "CANNABIS_R&D": [
    { icon: "🥾", label: "Porter des bottes de sécurité" },
    { icon: "🧢", label: "Porter un filet à cheveux" },
    { icon: "🥼", label: "Porter un sarot" },
    { icon: "🧤", label: "Porter des gants" },
  ],
  "SERVICES PRODUCTION": [
    { icon: "🥾", label: "Porter des bottes de sécurité" },
    { icon: "🧢", label: "Porter un filet à cheveux" },
    { icon: "🥼", label: "Porter un sarot" },
  ],
  "SERVICES TECHNIQUES": [
    { icon: "🥾", label: "Porter des bottes de sécurité" },
    { icon: "🦺", label: "Vêtements de sécurité" },
  ],
  "MAISON D'HERBES": [
    { icon: "🥾", label: "Porter des bottes de sécurité" },
    { icon: "🧢", label: "Porter un filet à cheveux" },
    { icon: "🥼", label: "Porter un sarot" },
    { icon: "❌", label: "Aucun bijoux" },
  ],
};

// ============================================================
// Props
// ============================================================

interface RoomSignProps {
  local: Local;
  targetUrl: string;
}

// ============================================================
// Component — US Letter landscape sign
// Layout matches the reference: 3 rows × 2 cols
//
//  ┌──────────┬──────────────────────────────┐
//  │  Badge   │                              │
//  │  (CAN)   │         Room Name            │
//  ├──────────┤      (spans 2 rows)          │
//  │          │                              │
//  │  QR Code │                              │
//  │          │                              │
//  ├──────────┼──────────────────────────────┤
//  │  Logo    │    Safety Requirements       │
//  │  Chanv   │    (pictograms)              │
//  └──────────┴──────────────────────────────┘
// ============================================================

export function PrintableRoomSign({ local, targetUrl }: RoomSignProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);

  const familleColor = FAMILLE_COLORS[local.famille] || "#94a3b8";
  const familleShort = FAMILLE_SHORT[local.famille] || local.idLicence || "?";
  const displayName = local.nomSalle || local.id;
  const safetyItems = SAFETY_ITEMS[local.famille] || [];
  const isProd = local.prod;

  // Generate QR code
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
        const qrSide = mc * m;

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

        // Wavy border
        const borderWidth = m * 0.8;
        const waveAmp = m * 1.2;
        const steps = 200;
        ctx.strokeStyle = "#242424";
        ctx.lineWidth = borderWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        const bx = qrOx - m * 0.5, by = qrOy - m * 0.5;
        const bw = qrSide + m, bh = qrSide + m;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) { const t = i / steps; const x = bx + t * bw; const y = by + Math.sin(t * Math.PI * 6 + 0.5) * waveAmp; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        for (let i = 0; i <= steps; i++) { const t = i / steps; ctx.lineTo(bx + bw + Math.sin(t * Math.PI * 6 + 1.5) * waveAmp, by + t * bh); }
        for (let i = 0; i <= steps; i++) { const t = i / steps; ctx.lineTo(bx + bw - t * bw, by + bh + Math.sin(t * Math.PI * 6 + 2.5) * waveAmp); }
        for (let i = 0; i <= steps; i++) { const t = i / steps; ctx.lineTo(bx + Math.sin(t * Math.PI * 6 + 3.5) * waveAmp, by + bh - t * bh); }
        ctx.closePath();
        ctx.stroke();

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

  if (!qrDataUrl) {
    return (
      <>
        <canvas ref={sourceRef} style={{ display: "none" }} />
        <canvas ref={drawRef} style={{ display: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 8, color: "#94a3b8", fontFamily: "Inter, sans-serif" }}>
          <Loader2 style={{ width: 24, height: 24, animation: "spin 1s linear infinite" }} />
          <span>Génération du panneau…</span>
        </div>
      </>
    );
  }

  // Adaptive font size: smaller for longer names
  const len = displayName.length;
  const nameFontSize = len > 30 ? "5vw" : len > 22 ? "6.5vw" : len > 15 ? "8vw" : "10vw";

  return (
    <>
      <canvas ref={sourceRef} style={{ display: "none" }} />
      <canvas ref={drawRef} style={{ display: "none" }} />



      {/* ============================================================ */}
      {/* THE SIGN                                                      */}
      {/* Uses percentage-based sizing for correct print proportions    */}
      {/* ============================================================ */}
      <div
        className="room-sign-page"
        style={{
          /* Aspect ratio = US Letter landscape (11:8.5 ≈ 1.294) */
          width: "11in",
          height: "8.5in",
          background: "#4a4a4a",
          margin: "60px auto 40px",
          padding: "1.5%",
          display: "grid",
          gridTemplateColumns: "22% 1fr",
          gridTemplateRows: "35% 1fr 28%",
          gap: "1.2%",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          boxSizing: "border-box",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* ── Row 1, Col 1: Famille badge ── */}
        <div style={{
          gridRow: 1,
          gridColumn: 1,
          backgroundColor: familleColor,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: "10vw",
          fontWeight: 900,
          lineHeight: 1,
        }}>
          {isProd ? "P" : familleShort.charAt(0)}
        </div>

        {/* ── Row 1+2, Col 2: Room name (spans 2 rows) ── */}
        <div style={{
          gridRow: "1 / 3",
          gridColumn: 2,
          background: "#fff",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4% 5%",
          textAlign: "center",
        }}>
          <div>
            <div style={{
              fontSize: nameFontSize,
              fontWeight: 800,
              color: "#1a1a1a",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}>
              {displayName}
            </div>
            {local.nomSalle && (
              <div style={{
                fontSize: "3vw",
                fontWeight: 500,
                color: "#aaa",
                marginTop: "0.8%",
                letterSpacing: "0.02em",
              }}>
                {local.id}
              </div>
            )}
          </div>
        </div>

        {/* ── Row 2, Col 1: QR Code ── */}
        <div style={{
          gridRow: 2,
          gridColumn: 1,
          background: "#fff",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6%",
          overflow: "hidden",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="QR Code"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>

        {/* ── Row 3, Col 1: Chanv logo ── */}
        <div style={{
          gridRow: 3,
          gridColumn: 1,
          background: "#fff",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8% 10%",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-groupe-chanv.svg"
            alt="Groupe Chanv"
            style={{ width: "100%", height: "auto", maxHeight: "100%", objectFit: "contain", filter: "brightness(0)" }}
          />
        </div>

        {/* ── Row 3, Col 2: Safety requirements ── */}
        <div style={{
          gridRow: 3,
          gridColumn: 2,
          background: "#fff",
          borderRadius: 10,
          display: "flex",
          flexDirection: "column" as const,
          padding: "1.5% 3%",
          justifyContent: "center",
        }}>
          {/* Empty for now */}
        </div>
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          @page {
            size: 11in 8.5in;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            background-image: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .room-sign-page {
            margin: 0 !important;
            border-radius: 0 !important;
            width: 11in !important;
            height: 8.5in !important;
            overflow: hidden !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }
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
          .room-sign-page {
            box-shadow: 0 8px 40px rgba(0,0,0,0.3);
            border-radius: 12px;
          }
        }
      `}</style>
    </>
  );
}
