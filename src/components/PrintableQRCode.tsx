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

        // Step 1: Get QR matrix
        await QRCode.toCanvas(source, targetUrl, {
          scale: 1,
          margin: 0,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "H",
        });

        const mc = source.width; // module count
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

        // Step 2: Sizing
        const quietZone = 3;
        const m = Math.max(8, Math.floor(600 / (mc + quietZone * 2)));
        const canvasSize = (mc + quietZone * 2) * m;
        const center = canvasSize / 2;
        const qrOx = quietZone * m;
        const qrOy = quietZone * m;

        draw.width = canvasSize;
        draw.height = canvasSize;
        const ctx = draw.getContext("2d");
        if (!ctx) return;

        // White background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // Seeded random
        function sr(seed: number): number {
          const v = Math.sin(seed * 9301 + 49297) * 49271;
          return v - Math.floor(v);
        }

        // Step 3: Wavy boundary function
        // For each edge, a sine wave determines how far modules extend
        // Returns true if module (row, col) is inside the wavy shape
        function isInsideWavyBorder(row: number, col: number): boolean {
          // Always keep finder patterns (7×7 corners)
          const isFinder =
            (row < 7 && col < 7) ||
            (row < 7 && col >= mc - 7) ||
            (row >= mc - 7 && col < 7);
          if (isFinder) return true;

          // Wavy edge: sine wave with amplitude ~1.5 modules
          const amp = 1.8;
          const freq = 0.45; // wave frequency

          // Distance from each edge
          const fromTop = row;
          const fromBottom = mc - 1 - row;
          const fromLeft = col;
          const fromRight = mc - 1 - col;

          // Wavy threshold for each edge (how many modules are "cut" on each side)
          const wavyTop = amp * Math.sin(col * freq + 0.5) + amp;
          const wavyBottom = amp * Math.sin(col * freq + 2.0) + amp;
          const wavyLeft = amp * Math.sin(row * freq + 1.0) + amp;
          const wavyRight = amp * Math.sin(row * freq + 3.0) + amp;

          // Module is outside if it's too close to any wavy edge
          if (fromTop < wavyTop) return false;
          if (fromBottom < wavyBottom) return false;
          if (fromLeft < wavyLeft) return false;
          if (fromRight < wavyRight) return false;

          return true;
        }

        // Step 4: Draw modules
        for (let row = 0; row < mc; row++) {
          for (let col = 0; col < mc; col++) {
            if (!matrix[row][col]) continue;
            if (!isInsideWavyBorder(row, col)) continue;

            const seed = row * mc + col;
            const px = qrOx + col * m;
            const py = qrOy + row * m;

            const isFinder =
              (row < 7 && col < 7) ||
              (row < 7 && col >= mc - 7) ||
              (row >= mc - 7 && col < 7);

            ctx.fillStyle = "#242424";

            if (isFinder) {
              const pad = m * 0.04;
              const rr = m * 0.28;
              drawRoundedRect(ctx, px + pad, py + pad, m - pad * 2, m - pad * 2, rr);
            } else {
              const pad = m * 0.05;
              const mw = m - pad * 2;
              const baseRadius = mw * 0.30;
              const wobble = mw * 0.18;
              const jx = (sr(seed + 1) - 0.5) * m * 0.04;
              const jy = (sr(seed + 2) - 0.5) * m * 0.04;

              const r1 = Math.max(1, baseRadius + (sr(seed + 10) - 0.5) * wobble);
              const r2 = Math.max(1, baseRadius + (sr(seed + 20) - 0.5) * wobble);
              const r3 = Math.max(1, baseRadius + (sr(seed + 30) - 0.5) * wobble);
              const r4 = Math.max(1, baseRadius + (sr(seed + 40) - 0.5) * wobble);

              drawVariableRect(ctx, px + pad + jx, py + pad + jy, mw, mw, r1, r2, r3, r4);
            }
          }
        }

        // Step 5: Logo in center — just the N with white circle background
        const icon = new Image();
        icon.crossOrigin = "anonymous";
        icon.src = "/favicon.svg";

        icon.onload = () => {
          const logoR = canvasSize * 0.11;

          // White circle
          ctx.beginPath();
          ctx.arc(center, center, logoR, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();

          // Thin border
          ctx.strokeStyle = "#242424";
          ctx.lineWidth = m * 0.2;
          ctx.stroke();

          // Draw icon
          const iconSize = logoR * 1.65;
          ctx.drawImage(icon, center - iconSize / 2, center - iconSize / 2, iconSize, iconSize);

          setFinalDataUrl(draw.toDataURL("image/png"));
        };

        icon.onerror = () => {
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
        className="w-64 h-64"
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
