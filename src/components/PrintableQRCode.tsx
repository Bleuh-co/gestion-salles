"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Printer, Loader2 } from "lucide-react";

interface PrintableQRCodeProps {
  localId: string;
  localNom?: string;
  targetUrl: string;
}

export function PrintableQRCode({ localId, localNom, targetUrl }: PrintableQRCodeProps) {
  const [finalDataUrl, setFinalDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function generate() {
      try {
        const source = sourceRef.current;
        const draw = drawRef.current;
        if (!source || !draw) return;

        // Step 1: Get QR matrix (1px per module)
        await QRCode.toCanvas(source, targetUrl, {
          scale: 1,
          margin: 0,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "H",
        });

        const moduleCount = source.width;
        const srcCtx = source.getContext("2d");
        if (!srcCtx) return;
        const imgData = srcCtx.getImageData(0, 0, moduleCount, moduleCount);

        const matrix: boolean[][] = [];
        for (let r = 0; r < moduleCount; r++) {
          matrix[r] = [];
          for (let c = 0; c < moduleCount; c++) {
            const idx = (r * moduleCount + c) * 4;
            matrix[r][c] = imgData.data[idx] < 128;
          }
        }

        // Step 2: Setup draw canvas
        const m = Math.max(10, Math.floor(700 / moduleCount)); // px per module
        const qrSize = moduleCount * m;
        // Extra padding for the "ears" that stick out
        const earPad = m * 2;
        const canvasSize = qrSize + earPad * 2;

        draw.width = canvasSize;
        draw.height = canvasSize;
        const ctx = draw.getContext("2d");
        if (!ctx) return;

        // Offsets — QR grid starts at (earPad, earPad)
        const ox = earPad;
        const oy = earPad;
        const center = canvasSize / 2;
        const circleR = qrSize / 2;

        // Seeded random
        function sr(seed: number): number {
          const v = Math.sin(seed * 9301 + 49297) * 49271;
          return v - Math.floor(v);
        }

        // Transparent background
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        // Step 3: Draw circular background (subtle gray ring)
        ctx.beginPath();
        ctx.arc(center, center, circleR + m * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "#f5f0e8";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(center, center, circleR - m * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();

        // Step 4: Draw modules
        ctx.fillStyle = "#282828";

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (!matrix[row][col]) continue;

            const seed = row * moduleCount + col;
            const px = ox + col * m;
            const py = oy + row * m;

            // Module center
            const mcx = px + m / 2;
            const mcy = py + m / 2;

            // Is this a finder pattern? (3 corners, 7×7 blocks)
            const isFinder =
              (row < 7 && col < 7) ||
              (row < 7 && col >= moduleCount - 7) ||
              (row >= moduleCount - 7 && col < 7);

            // Distance from circle center
            const dist = Math.sqrt((mcx - center) ** 2 + (mcy - center) ** 2);

            // Skip modules outside circle UNLESS they're finder patterns
            if (!isFinder && dist > circleR - m * 0.5) continue;

            if (isFinder) {
              // Finder patterns — clean rounded squares (always drawn, even outside circle)
              const pad = m * 0.04;
              const rr = m * 0.35;
              drawRoundedRect(ctx, px + pad, py + pad, m - pad * 2, m - pad * 2, rr);
            } else {
              // Organic modules with visible wobble
              const pad = m * 0.06;
              const mw = m - pad * 2;
              const baseRadius = mw * 0.40;
              const wobble = mw * 0.35;

              const jx = (sr(seed + 1) - 0.5) * m * 0.12;
              const jy = (sr(seed + 2) - 0.5) * m * 0.12;

              const r1 = Math.max(1, baseRadius + (sr(seed + 10) - 0.5) * wobble);
              const r2 = Math.max(1, baseRadius + (sr(seed + 20) - 0.5) * wobble);
              const r3 = Math.max(1, baseRadius + (sr(seed + 30) - 0.5) * wobble);
              const r4 = Math.max(1, baseRadius + (sr(seed + 40) - 0.5) * wobble);

              const sizeVar = 1 + (sr(seed + 50) - 0.5) * 0.10;
              const aw = mw * sizeVar;
              const ah = mw * sizeVar;
              const oxx = (mw - aw) / 2;
              const oyy = (mw - ah) / 2;

              drawVariableRect(ctx, px + pad + jx + oxx, py + pad + jy + oyy, aw, ah, r1, r2, r3, r4);
            }
          }
        }

        // Step 5: Draw the circle outline (border ring)
        ctx.beginPath();
        ctx.arc(center, center, circleR + m * 0.3, 0, Math.PI * 2);
        ctx.strokeStyle = "#282828";
        ctx.lineWidth = m * 0.35;
        ctx.stroke();

        // Step 6: White-out modules outside circle (except finder corners)
        // Draw white arcs to erase stray modules between circle and finder ears
        // This creates the "ear" effect — clean circle with 3 square bumps

        // Step 7: Logo overlay (Chanv N) in center
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "/favicon.svg";

        logo.onload = () => {
          const logoSize = canvasSize * 0.24;
          const logoPad = logoSize * 0.15;

          // White circle behind logo
          ctx.beginPath();
          ctx.arc(center, center, (logoSize + logoPad) / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();

          // Thin ring
          ctx.strokeStyle = "#282828";
          ctx.lineWidth = m * 0.2;
          ctx.stroke();

          // Draw logo
          ctx.drawImage(logo, center - logoSize / 2, center - logoSize / 2, logoSize, logoSize);

          setFinalDataUrl(draw.toDataURL("image/png"));
        };

        logo.onerror = () => {
          setFinalDataUrl(draw.toDataURL("image/png"));
        };
      } catch (err) {
        console.error("QR generation error:", err);
        setError("Erreur de génération du QR code");
      }
    }

    generate();
  }, [targetUrl]);

  if (error) {
    return <div className="text-center py-12 text-red-500 text-sm">{error}</div>;
  }

  if (!finalDataUrl) {
    return (
      <>
        <canvas ref={sourceRef} style={{ display: "none" }} />
        <canvas ref={drawRef} style={{ display: "none" }} />
        <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Génération du QR…</span>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <canvas ref={sourceRef} style={{ display: "none" }} />
      <canvas ref={drawRef} style={{ display: "none" }} />

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-chanv-terre">{localId}</h1>
        {localNom && <p className="text-sm text-slate-500">{localNom}</p>}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={finalDataUrl}
        alt={`QR code pour ${localId}`}
        className="w-72 h-72"
        style={{ imageRendering: "auto" }}
      />

      <p className="text-xs text-slate-400 font-mono break-all max-w-xs text-center">{targetUrl}</p>

      <button
        onClick={() => window.print()}
        className="btn-primary flex items-center gap-2 print:hidden"
      >
        <Printer className="w-4 h-4" />
        Imprimer
      </button>
    </div>
  );
}

/** Clean rounded rect */
function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/** Rounded rect with 4 different corner radii */
function drawVariableRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r1: number, r2: number, r3: number, r4: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r1, y);
  ctx.lineTo(x + w - r2, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r2);
  ctx.lineTo(x + w, y + h - r3);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r3, y + h);
  ctx.lineTo(x + r4, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r4);
  ctx.lineTo(x, y + r1);
  ctx.quadraticCurveTo(x, y, x + r1, y);
  ctx.closePath();
  ctx.fill();
}
