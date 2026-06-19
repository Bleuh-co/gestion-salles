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

        // Step 1: Render QR at scale=1 so each module = 1 pixel (no margin)
        await QRCode.toCanvas(source, targetUrl, {
          scale: 1,
          margin: 0,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "H",
        });

        // Now source.width = moduleCount (each module is exactly 1px)
        const moduleCount = source.width;
        const srcCtx = source.getContext("2d");
        if (!srcCtx) return;
        const imgData = srcCtx.getImageData(0, 0, moduleCount, moduleCount);

        // Build boolean matrix (1px per module, trivial)
        const matrix: boolean[][] = [];
        for (let r = 0; r < moduleCount; r++) {
          matrix[r] = [];
          for (let c = 0; c < moduleCount; c++) {
            const idx = (r * moduleCount + c) * 4;
            matrix[r][c] = imgData.data[idx] < 128;
          }
        }

        // Step 2: Redraw with organic style
        const drawMargin = 3;
        const drawModuleSize = Math.max(8, Math.floor(600 / (moduleCount + drawMargin * 2)));
        const totalModules = moduleCount + drawMargin * 2;
        const canvasSize = totalModules * drawModuleSize;

        draw.width = canvasSize;
        draw.height = canvasSize;
        const ctx = draw.getContext("2d");
        if (!ctx) return;

        // White background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // Seeded pseudo-random
        function sr(seed: number): number {
          const v = Math.sin(seed * 9301 + 49297) * 49271;
          return v - Math.floor(v);
        }

        ctx.fillStyle = "#282828";

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (!matrix[row][col]) continue;

            const seed = row * moduleCount + col;
            const px = (col + drawMargin) * drawModuleSize;
            const py = (row + drawMargin) * drawModuleSize;

            const isFinder =
              (row < 7 && col < 7) ||
              (row < 7 && col >= moduleCount - 7) ||
              (row >= moduleCount - 7 && col < 7);

            if (isFinder) {
              // Finder patterns: very rounded squares
              const pad = drawModuleSize * 0.04;
              const rr = drawModuleSize * 0.40;
              drawRoundedRect(ctx, px + pad, py + pad, drawModuleSize - pad * 2, drawModuleSize - pad * 2, rr);
            } else {
              // Organic modules — VERY visible wobble
              const pad = drawModuleSize * 0.06;
              const mw = drawModuleSize - pad * 2;

              // Very rounded base (45% = nearly circular)
              const baseRadius = mw * 0.45;
              // Big wobble range (±40% of module size)
              const wobble = mw * 0.40;

              // Strong position jitter (±8% of module)
              const jx = (sr(seed + 1) - 0.5) * drawModuleSize * 0.16;
              const jy = (sr(seed + 2) - 0.5) * drawModuleSize * 0.16;

              // Each corner wildly different
              const r1 = Math.max(1, baseRadius + (sr(seed + 10) - 0.5) * wobble);
              const r2 = Math.max(1, baseRadius + (sr(seed + 20) - 0.5) * wobble);
              const r3 = Math.max(1, baseRadius + (sr(seed + 30) - 0.5) * wobble);
              const r4 = Math.max(1, baseRadius + (sr(seed + 40) - 0.5) * wobble);

              // Slight size variation per module (±6%)
              const sizeVar = 1 + (sr(seed + 50) - 0.5) * 0.12;
              const aw = mw * sizeVar;
              const ah = mw * sizeVar;
              const ox = (mw - aw) / 2;
              const oy = (mw - ah) / 2;

              drawVariableRect(ctx, px + pad + jx + ox, py + pad + jy + oy, aw, ah, r1, r2, r3, r4);
            }
          }
        }

        // Step 3: Logo overlay (25%)
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "/favicon.svg";

        logo.onload = () => {
          const logoSize = canvasSize * 0.25;
          const logoPad = logoSize * 0.18;
          const cx = canvasSize / 2;
          const cy = canvasSize / 2;

          // White circle background
          ctx.beginPath();
          ctx.arc(cx, cy, (logoSize + logoPad) / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = "#E0D5C0";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Draw logo
          ctx.drawImage(logo, cx - logoSize / 2, cy - logoSize / 2, logoSize, logoSize);
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
        className="w-64 h-64 border border-chanv-fibre rounded-2xl p-2"
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

/** Clean rounded rect (for finder patterns) */
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

/** Rounded rect with 4 different corner radii (for organic modules) */
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
