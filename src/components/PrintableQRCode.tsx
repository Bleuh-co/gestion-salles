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

        // Step 2: Sizing
        const m = Math.max(8, Math.floor(550 / moduleCount)); // px per module
        const qrSide = moduleCount * m;
        // Circle inscribed in the QR square (touches middle of each edge)
        const circleR = qrSide / 2;
        const ringThick = m * 1.6;
        // Canvas needs extra room for finder patterns that protrude beyond circle
        const extraPad = m * 4;
        const canvasSize = Math.ceil(circleR * 2 + ringThick * 2 + extraPad);
        const center = canvasSize / 2;

        draw.width = canvasSize;
        draw.height = canvasSize;
        const ctx = draw.getContext("2d");
        if (!ctx) return;

        // QR grid origin (centered)
        const qrOx = center - qrSide / 2;
        const qrOy = center - qrSide / 2;

        // Transparent canvas
        ctx.clearRect(0, 0, canvasSize, canvasSize);

        // White circle background
        ctx.beginPath();
        ctx.arc(center, center, circleR, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();

        // Seeded random
        function sr(seed: number): number {
          const v = Math.sin(seed * 9301 + 49297) * 49271;
          return v - Math.floor(v);
        }

        // Step 3: Draw data modules ONLY inside the circle
        ctx.fillStyle = "#242424";

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (!matrix[row][col]) continue;

            const px = qrOx + col * m;
            const py = qrOy + row * m;
            const mcx = px + m / 2;
            const mcy = py + m / 2;

            // Is finder pattern?
            const isFinder =
              (row < 7 && col < 7) ||
              (row < 7 && col >= moduleCount - 7) ||
              (row >= moduleCount - 7 && col < 7);

            // Distance from center
            const dist = Math.sqrt((mcx - center) ** 2 + (mcy - center) ** 2);

            // Data modules: only draw if inside the circle (with small margin for the ring)
            if (!isFinder) {
              if (dist > circleR - ringThick / 2 - m * 0.5) continue;

              const seed = row * moduleCount + col;
              const pad = m * 0.06;
              const mw = m - pad * 2;
              const baseRadius = mw * 0.32;
              const wobble = mw * 0.22;
              const jx = (sr(seed + 1) - 0.5) * m * 0.06;
              const jy = (sr(seed + 2) - 0.5) * m * 0.06;

              const r1 = Math.max(1, baseRadius + (sr(seed + 10) - 0.5) * wobble);
              const r2 = Math.max(1, baseRadius + (sr(seed + 20) - 0.5) * wobble);
              const r3 = Math.max(1, baseRadius + (sr(seed + 30) - 0.5) * wobble);
              const r4 = Math.max(1, baseRadius + (sr(seed + 40) - 0.5) * wobble);

              drawVariableRect(ctx, px + pad + jx, py + pad + jy, mw, mw, r1, r2, r3, r4);
            }
          }
        }

        // Step 4: Thick black circle ring
        ctx.beginPath();
        ctx.arc(center, center, circleR, 0, Math.PI * 2);
        ctx.strokeStyle = "#242424";
        ctx.lineWidth = ringThick;
        ctx.stroke();

        // Step 5: Draw 3 finder patterns (OUTSIDE the circle, protruding)
        // These are the standard 7×7 QR finder patterns at 3 corners
        const finderPositions = [
          { row: 0, col: 0 },                          // top-left
          { row: 0, col: moduleCount - 7 },             // top-right
          { row: moduleCount - 7, col: 0 },             // bottom-left
        ];

        for (const fp of finderPositions) {
          const fx = qrOx + fp.col * m;
          const fy = qrOy + fp.row * m;
          const fSize = 7 * m;
          const finderPad = m * 0.3;

          // White background behind finder
          ctx.fillStyle = "#FFFFFF";
          drawRoundedRect(ctx, fx - finderPad, fy - finderPad, fSize + finderPad * 2, fSize + finderPad * 2, m * 0.5);

          // Draw finder modules
          ctx.fillStyle = "#242424";
          for (let r = fp.row; r < fp.row + 7; r++) {
            for (let c = fp.col; c < fp.col + 7; c++) {
              if (!matrix[r]?.[c]) continue;
              const mpx = qrOx + c * m;
              const mpy = qrOy + r * m;
              const pad = m * 0.04;
              const rr = m * 0.25;
              drawRoundedRect(ctx, mpx + pad, mpy + pad, m - pad * 2, m - pad * 2, rr);
            }
          }
        }

        // Step 6: White circle center + N from Chanv
        const nRadius = canvasSize * 0.14;

        // White circle
        ctx.beginPath();
        ctx.arc(center, center, nRadius, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();

        // Load and draw the N
        const icon = new Image();
        icon.crossOrigin = "anonymous";
        icon.src = "/favicon.svg";

        icon.onload = () => {
          const iconSize = nRadius * 1.7;
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
        className="w-72 h-72"
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
