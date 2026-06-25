"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Printer, Loader2, ArrowLeft } from "lucide-react";
import type { Local } from "@/lib/types";
import { FAMILLE_COLORS, FAMILLE_SHORT } from "@/lib/types";

// ============================================================
// Safety pictograms per famille (can be extended)
// ============================================================

interface SafetyItem {
  icon: string; // emoji or text
  label: string;
}

// Default safety requirements by famille — adapt as needed
const SAFETY_ITEMS: Record<string, SafetyItem[]> = {
  CANNABIS: [
    { icon: "🥾", label: "BOTTES DE SÉCURITÉ" },
    { icon: "🧢", label: "FILET À CHEVEUX" },
    { icon: "🥼", label: "SARRAU" },
    { icon: "🚫💍", label: "AUCUN BIJOU" },
  ],
  PSN: [
    { icon: "🥾", label: "BOTTES DE SÉCURITÉ" },
    { icon: "🧢", label: "FILET À CHEVEUX" },
    { icon: "🥼", label: "SARRAU" },
    { icon: "🚫💍", label: "AUCUN BIJOU" },
  ],
  ALI: [
    { icon: "🥾", label: "BOTTES DE SÉCURITÉ" },
    { icon: "🧢", label: "FILET À CHEVEUX" },
    { icon: "🥼", label: "SARRAU" },
    { icon: "🚫💍", label: "AUCUN BIJOU" },
  ],
  "CANNABIS_R&D": [
    { icon: "🥾", label: "BOTTES DE SÉCURITÉ" },
    { icon: "🧢", label: "FILET À CHEVEUX" },
    { icon: "🥼", label: "SARRAU" },
    { icon: "🧤", label: "GANTS" },
  ],
  "SERVICES PRODUCTION": [
    { icon: "🥾", label: "BOTTES DE SÉCURITÉ" },
    { icon: "🧢", label: "FILET À CHEVEUX" },
    { icon: "🥼", label: "SARRAU" },
  ],
  "SERVICES TECHNIQUES": [
    { icon: "🥾", label: "BOTTES DE SÉCURITÉ" },
    { icon: "🦺", label: "VÊTEMENTS DE SÉCURITÉ" },
  ],
  "MAISON D'HERBES": [
    { icon: "🥾", label: "BOTTES DE SÉCURITÉ" },
    { icon: "🧢", label: "FILET À CHEVEUX" },
    { icon: "🥼", label: "SARRAU" },
    { icon: "🚫💍", label: "AUCUN BIJOU" },
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
// Component
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
        const bx = qrOx - m * 0.5;
        const by = qrOy - m * 0.5;
        const bw = qrSide + m;
        const bh = qrSide + m;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = bx + t * bw;
          const y = by + Math.sin(t * Math.PI * 6 + 0.5) * waveAmp;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          ctx.lineTo(bx + bw + Math.sin(t * Math.PI * 6 + 1.5) * waveAmp, by + t * bh);
        }
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          ctx.lineTo(bx + bw - t * bw, by + bh + Math.sin(t * Math.PI * 6 + 2.5) * waveAmp);
        }
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          ctx.lineTo(bx + Math.sin(t * Math.PI * 6 + 3.5) * waveAmp, by + bh - t * bh);
        }
        ctx.closePath();
        ctx.stroke();

        // Chanv icon in center
        const icon = new Image();
        icon.crossOrigin = "anonymous";
        icon.src = "/favicon.svg";
        icon.onload = () => {
          const logoR = canvasSize * 0.138;
          ctx.beginPath();
          ctx.arc(center, center, logoR, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          const iconSize = logoR * 1.8;
          ctx.drawImage(icon, center - iconSize / 2, center - iconSize / 2, iconSize, iconSize);
          setQrDataUrl(draw.toDataURL("image/png"));
        };
        icon.onerror = () => setQrDataUrl(draw.toDataURL("image/png"));
      } catch (err) {
        console.error("QR generation error:", err);
      }
    }
    generate();
  }, [targetUrl]);

  if (!qrDataUrl) {
    return (
      <>
        <canvas ref={sourceRef} style={{ display: "none" }} />
        <canvas ref={drawRef} style={{ display: "none" }} />
        <div className="flex items-center justify-center min-h-screen gap-2 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Génération du panneau…</span>
        </div>
      </>
    );
  }

  return (
    <>
      <canvas ref={sourceRef} style={{ display: "none" }} />
      <canvas ref={drawRef} style={{ display: "none" }} />

      {/* Print button — hidden when printing */}
      <div className="print:hidden fixed top-6 left-6 z-50 flex gap-3">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-chanv-terre transition-colors bg-white px-3 py-2 rounded-lg shadow"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
        <button
          onClick={() => window.print()}
          className="btn-primary flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Imprimer
        </button>
      </div>

      {/* =========================================================== */}
      {/* THE SIGN — US Letter landscape: 11" × 8.5"                  */}
      {/* =========================================================== */}
      <div
        className="room-sign-page"
        style={{
          width: "11in",
          height: "8.5in",
          background: "#3a3a3a",
          margin: "0 auto",
          padding: "0.3in",
          display: "grid",
          gridTemplateColumns: "2.5in 1fr",
          gridTemplateRows: "1fr 2.5in",
          gap: "0.2in",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* ── TOP-LEFT: Famille badge + QR code ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.2in",
          }}
        >
          {/* Famille badge */}
          <div
            style={{
              backgroundColor: familleColor,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "2.2in",
              fontWeight: 900,
              lineHeight: 1,
              height: "2.5in",
              letterSpacing: "-0.02em",
            }}
          >
            {isProd ? "P" : familleShort.charAt(0)}
          </div>

          {/* QR Code */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.15in",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="QR Code"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
        </div>

        {/* ── TOP-RIGHT: Room name ── */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.4in",
            textAlign: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: displayName.length > 20 ? "2.4in" : displayName.length > 12 ? "2.8in" : "3.2in",
                fontWeight: 900,
                color: "#1a1a1a",
                lineHeight: 1,
                letterSpacing: "-0.03em",
                textTransform: "capitalize",
                wordBreak: "break-word",
              }}
            >
              {displayName.toLowerCase()}
            </div>
            {local.nomSalle && (
              <div
                style={{
                  fontSize: "0.5in",
                  fontWeight: 500,
                  color: "#888",
                  marginTop: "0.15in",
                  letterSpacing: "0.05em",
                }}
              >
                {local.id}
              </div>
            )}
          </div>
        </div>

        {/* ── BOTTOM-LEFT: Chanv logo ── */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.3in",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-groupe-chanv.svg"
            alt="Groupe Chanv"
            style={{ width: "100%", height: "auto", maxHeight: "100%", objectFit: "contain", filter: "brightness(0)" }}
          />
        </div>

        {/* ── BOTTOM-RIGHT: Safety requirements ── */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            padding: "0.25in 0.35in",
            justifyContent: "center",
          }}
        >
          {safetyItems.length > 0 ? (
            <>
              <div
                style={{
                  fontSize: "0.22in",
                  fontWeight: 800,
                  color: "#1a3a6b",
                  letterSpacing: "0.12em",
                  textAlign: "center",
                  marginBottom: "0.18in",
                  textTransform: "uppercase",
                }}
              >
                Obligatoire
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0.3in",
                  flexWrap: "wrap",
                }}
              >
                {safetyItems.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.08in",
                      width: "1.3in",
                    }}
                  >
                    <div
                      style={{
                        width: "0.9in",
                        height: "0.9in",
                        borderRadius: "50%",
                        background: "#1a3a6b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.5in",
                        color: "white",
                      }}
                    >
                      {item.icon}
                    </div>
                    <div
                      style={{
                        fontSize: "0.11in",
                        fontWeight: 700,
                        color: "#1a3a6b",
                        textAlign: "center",
                        textTransform: "uppercase",
                        lineHeight: 1.2,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.15in",
                height: "100%",
              }}
            >
              <div style={{ fontSize: "0.28in", fontWeight: 800, color: "#94a3b8" }}>
                {local.famille}
              </div>
              <div style={{ fontSize: "0.18in", color: "#94a3b8" }}>
                {local.vocation}
              </div>
              {local.niveauAcces && local.niveauAcces !== "Employés" && (
                <div
                  style={{
                    fontSize: "0.16in",
                    fontWeight: 700,
                    color: "#d97706",
                    border: "2px solid #d97706",
                    borderRadius: 8,
                    padding: "0.05in 0.15in",
                    marginTop: "0.05in",
                  }}
                >
                  ⚠️ Accès {local.niveauAcces}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          @page {
            size: 11in 8.5in landscape;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .room-sign-page {
            margin: 0 !important;
            page-break-after: always;
          }
        }
      `}</style>
    </>
  );
}
