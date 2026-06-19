"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Printer, Loader2 } from "lucide-react";

interface PrintableQRCodeProps {
  localId: string;
  localNom?: string;
  targetUrl: string;
}

/**
 * Draw a QR code with rounded "dot" modules and an oversized Chanv logo.
 * Uses qrcode lib to generate the matrix, then paints each module as a
 * rounded rect instead of a sharp square — gives a modern organic feel.
 */
export function PrintableQRCode({ localId, localNom, targetUrl }: PrintableQRCodeProps) {
  const [finalDataUrl, setFinalDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function generate() {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Generate QR matrix data
        const qr = QRCode.create(targetUrl, { errorCorrectionLevel: "H" });
        const modules = qr.modules;
        const moduleCount = modules.size;

        // Canvas sizing
        const margin = 4; // modules of margin
        const totalModules = moduleCount + margin * 2;
        const moduleSize = 16; // px per module — high res
        const canvasSize = totalModules * moduleSize;

        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // White background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // Draw each module as a slightly wobbly rounded square
        const dotColor = "#282828";

        // Seeded pseudo-random for consistent rendering
        function seededRandom(seed: number): number {
          const x = Math.sin(seed * 9301 + 49297) * 49271;
          return x - Math.floor(x);
        }

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (!modules.get(row, col)) continue;

            const seed = row * moduleCount + col;
            const px = (col + margin) * moduleSize;
            const py = (row + margin) * moduleSize;

            // Check if this is a finder pattern (top-left, top-right, bottom-left 7×7 blocks)
            const isFinder =
              (row < 7 && col < 7) ||
              (row < 7 && col >= moduleCount - 7) ||
              (row >= moduleCount - 7 && col < 7);

            ctx.fillStyle = dotColor;

            if (isFinder) {
              // Finder patterns: clean rounded squares (must stay recognizable)
              const pad = moduleSize * 0.06;
              const rr = moduleSize * 0.32;
              wobblyRect(ctx, px + pad, py + pad, moduleSize - pad * 2, moduleSize - pad * 2, rr, 0); // no wobble
            } else {
              // Regular modules: wobbly organic squares
              const pad = moduleSize * 0.08;
              const baseRadius = moduleSize * 0.28;
              const wobbleAmount = moduleSize * 0.12;
              // Slight position jitter
              const jx = (seededRandom(seed + 1) - 0.5) * moduleSize * 0.06;
              const jy = (seededRandom(seed + 2) - 0.5) * moduleSize * 0.06;
              wobblyRect(
                ctx,
                px + pad + jx,
                py + pad + jy,
                moduleSize - pad * 2,
                moduleSize - pad * 2,
                baseRadius,
                wobbleAmount,
                seed
              );
            }
          }
        }

        // Logo overlay — large (32% of canvas)
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "/favicon.svg";

        logo.onload = () => {
          const logoSize = canvasSize * 0.32;
          const logoPad = logoSize * 0.12;
          const centerX = canvasSize / 2;
          const centerY = canvasSize / 2;

          // White circle background
          ctx.beginPath();
          ctx.arc(centerX, centerY, (logoSize + logoPad) / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();

          // Subtle border
          ctx.strokeStyle = "#E0D5C0";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw logo
          ctx.drawImage(
            logo,
            centerX - logoSize / 2,
            centerY - logoSize / 2,
            logoSize,
            logoSize
          );

          setFinalDataUrl(canvas.toDataURL("image/png"));
        };

        logo.onerror = () => {
          setFinalDataUrl(canvas.toDataURL("image/png"));
        };
      } catch {
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
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Génération du QR…</span>
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <canvas ref={canvasRef} style={{ display: "none" }} />

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

/** Helper: draw a filled rounded rectangle with optional organic wobble */
function wobblyRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  baseR: number,
  wobble: number = 0,
  seed: number = 0
) {
  // Seeded random for per-corner variation
  function sr(s: number): number {
    const v = Math.sin(s * 9301 + 49297) * 49271;
    return v - Math.floor(v);
  }

  // Each corner gets a slightly different radius
  const r1 = Math.max(1, baseR + (sr(seed + 10) - 0.5) * wobble * 2);
  const r2 = Math.max(1, baseR + (sr(seed + 20) - 0.5) * wobble * 2);
  const r3 = Math.max(1, baseR + (sr(seed + 30) - 0.5) * wobble * 2);
  const r4 = Math.max(1, baseR + (sr(seed + 40) - 0.5) * wobble * 2);

  // Slight edge bulge for organic feel
  const bx = wobble > 0 ? (sr(seed + 50) - 0.5) * wobble * 0.6 : 0;
  const by = wobble > 0 ? (sr(seed + 60) - 0.5) * wobble * 0.6 : 0;

  ctx.beginPath();
  // Top edge
  ctx.moveTo(x + r1, y);
  ctx.lineTo(x + w - r2, y);
  // Top-right corner
  ctx.quadraticCurveTo(x + w + bx * 0.3, y - by * 0.3, x + w, y + r2);
  // Right edge
  ctx.lineTo(x + w, y + h - r3);
  // Bottom-right corner
  ctx.quadraticCurveTo(x + w + bx * 0.3, y + h + by * 0.3, x + w - r3, y + h);
  // Bottom edge
  ctx.lineTo(x + r4, y + h);
  // Bottom-left corner
  ctx.quadraticCurveTo(x - bx * 0.3, y + h + by * 0.3, x, y + h - r4);
  // Left edge
  ctx.lineTo(x, y + r1);
  // Top-left corner
  ctx.quadraticCurveTo(x - bx * 0.3, y - by * 0.3, x + r1, y);
  ctx.closePath();
  ctx.fill();
}
