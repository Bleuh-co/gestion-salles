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

        // Draw each module as a rounded dot
        const dotColor = "#282828";
        const dotRadius = moduleSize * 0.38; // slightly smaller than cell → gaps between dots

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (!modules.get(row, col)) continue;

            const cx = (col + margin) * moduleSize + moduleSize / 2;
            const cy = (row + margin) * moduleSize + moduleSize / 2;

            // Check if this is a finder pattern (top-left, top-right, bottom-left 7×7 blocks)
            const isFinder =
              (row < 7 && col < 7) ||
              (row < 7 && col >= moduleCount - 7) ||
              (row >= moduleCount - 7 && col < 7);

            if (isFinder) {
              // Finder patterns: draw as rounded squares for recognizability
              const pad = moduleSize * 0.08;
              const rr = moduleSize * 0.3;
              ctx.fillStyle = dotColor;
              roundRect(ctx, (col + margin) * moduleSize + pad, (row + margin) * moduleSize + pad, moduleSize - pad * 2, moduleSize - pad * 2, rr);
            } else {
              // Regular modules: circles
              ctx.beginPath();
              ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
              ctx.fillStyle = dotColor;
              ctx.fill();
            }
          }
        }

        // Logo overlay — bigger (28% of canvas)
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "/favicon.svg";

        logo.onload = () => {
          const logoSize = canvasSize * 0.28;
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

/** Helper: draw a filled rounded rectangle */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
