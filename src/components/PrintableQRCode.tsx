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
 * QR code with organic wobbly modules and large Chanv logo.
 * Uses toCanvas to generate the QR, reads pixel data to get the matrix,
 * then redraws with custom organic shapes.
 */
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

        // Step 1: Generate standard QR onto hidden canvas
        const tempSize = 400;
        await QRCode.toCanvas(source, targetUrl, {
          width: tempSize,
          margin: 0,
          color: { dark: "#000000", light: "#FFFFFF" },
          errorCorrectionLevel: "H",
        });

        // Step 2: Read the pixel data to extract module matrix
        const srcCtx = source.getContext("2d");
        if (!srcCtx) return;
        const imgData = srcCtx.getImageData(0, 0, tempSize, tempSize);

        // Detect module size by scanning top row for first dark pixel
        let moduleSize = 1;
        const firstDarkX = findFirstDark(imgData, tempSize);
        if (firstDarkX >= 0) {
          // Count consecutive dark pixels to get module size
          let count = 0;
          for (let x = firstDarkX; x < tempSize; x++) {
            const idx = x * 4;
            if (imgData.data[idx] < 128) count++;
            else break;
          }
          moduleSize = Math.max(1, count);
        }

        const moduleCount = Math.round(tempSize / moduleSize);

        // Build boolean matrix
        const matrix: boolean[][] = [];
        for (let r = 0; r < moduleCount; r++) {
          matrix[r] = [];
          for (let c = 0; c < moduleCount; c++) {
            // Sample center of module
            const px = Math.floor(c * moduleSize + moduleSize / 2);
            const py = Math.floor(r * moduleSize + moduleSize / 2);
            const idx = (py * tempSize + px) * 4;
            matrix[r][c] = idx < imgData.data.length && imgData.data[idx] < 128;
          }
        }

        // Step 3: Redraw with organic style
        const drawMargin = 4; // modules of whitespace
        const drawModuleSize = 14; // px per module
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

        const dotColor = "#282828";
        ctx.fillStyle = dotColor;

        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (!matrix[row]?.[col]) continue;

            const seed = row * moduleCount + col;
            const px = (col + drawMargin) * drawModuleSize;
            const py = (row + drawMargin) * drawModuleSize;

            const isFinder =
              (row < 7 && col < 7) ||
              (row < 7 && col >= moduleCount - 7) ||
              (row >= moduleCount - 7 && col < 7);

            if (isFinder) {
              // Clean rounded squares for finder patterns
              const pad = drawModuleSize * 0.06;
              const rr = drawModuleSize * 0.32;
              drawWobblyRect(ctx, px + pad, py + pad, drawModuleSize - pad * 2, drawModuleSize - pad * 2, rr, 0, 0);
            } else {
              // Organic wobbly modules
              const pad = drawModuleSize * 0.08;
              const baseRadius = drawModuleSize * 0.28;
              const wobbleAmount = drawModuleSize * 0.12;
              const jx = (sr(seed + 1) - 0.5) * drawModuleSize * 0.06;
              const jy = (sr(seed + 2) - 0.5) * drawModuleSize * 0.06;
              drawWobblyRect(
                ctx,
                px + pad + jx, py + pad + jy,
                drawModuleSize - pad * 2, drawModuleSize - pad * 2,
                baseRadius, wobbleAmount, seed
              );
            }
          }
        }

        // Step 4: Draw logo
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "/favicon.svg";

        logo.onload = () => {
          const logoSize = canvasSize * 0.30;
          const logoPad = logoSize * 0.14;
          const cx = canvasSize / 2;
          const cy = canvasSize / 2;

          // White circle background
          ctx.beginPath();
          ctx.arc(cx, cy, (logoSize + logoPad) / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = "#E0D5C0";
          ctx.lineWidth = 2;
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

/** Find the X coordinate of the first dark pixel in the top row */
function findFirstDark(imgData: ImageData, width: number): number {
  for (let x = 0; x < width; x++) {
    if (imgData.data[x * 4] < 128) return x;
  }
  return -1;
}

/** Draw a filled rounded rect with optional organic wobble */
function drawWobblyRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  baseR: number,
  wobble: number = 0,
  seed: number = 0
) {
  function sr(s: number): number {
    const v = Math.sin(s * 9301 + 49297) * 49271;
    return v - Math.floor(v);
  }

  const r1 = Math.max(1, baseR + (sr(seed + 10) - 0.5) * wobble * 2);
  const r2 = Math.max(1, baseR + (sr(seed + 20) - 0.5) * wobble * 2);
  const r3 = Math.max(1, baseR + (sr(seed + 30) - 0.5) * wobble * 2);
  const r4 = Math.max(1, baseR + (sr(seed + 40) - 0.5) * wobble * 2);

  const bx = wobble > 0 ? (sr(seed + 50) - 0.5) * wobble * 0.6 : 0;
  const by = wobble > 0 ? (sr(seed + 60) - 0.5) * wobble * 0.6 : 0;

  ctx.beginPath();
  ctx.moveTo(x + r1, y);
  ctx.lineTo(x + w - r2, y);
  ctx.quadraticCurveTo(x + w + bx * 0.3, y - by * 0.3, x + w, y + r2);
  ctx.lineTo(x + w, y + h - r3);
  ctx.quadraticCurveTo(x + w + bx * 0.3, y + h + by * 0.3, x + w - r3, y + h);
  ctx.lineTo(x + r4, y + h);
  ctx.quadraticCurveTo(x - bx * 0.3, y + h + by * 0.3, x, y + h - r4);
  ctx.lineTo(x, y + r1);
  ctx.quadraticCurveTo(x - bx * 0.3, y - by * 0.3, x + r1, y);
  ctx.closePath();
  ctx.fill();
}
