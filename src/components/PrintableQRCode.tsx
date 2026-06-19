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

        // Step 2: Sizing
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

        // White background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        // Step 3: Draw ALL QR modules — standard squares, no wobble
        ctx.fillStyle = "#242424";

        for (let row = 0; row < mc; row++) {
          for (let col = 0; col < mc; col++) {
            if (!matrix[row][col]) continue;
            const px = qrOx + col * m;
            const py = qrOy + row * m;
            ctx.fillRect(px, py, m, m);
          }
        }

        // Step 4: Wavy solid border around the QR perimeter
        const borderWidth = m * 0.8;
        const waveAmp = m * 1.2; // wave amplitude
        const waveFreq = 0.08; // wave frequency
        const steps = 200; // smoothness

        ctx.strokeStyle = "#242424";
        ctx.lineWidth = borderWidth;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        // QR bounding box
        const bx = qrOx - m * 0.5;
        const by = qrOy - m * 0.5;
        const bw = qrSide + m;
        const bh = qrSide + m;

        ctx.beginPath();

        // Top edge (left to right)
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = bx + t * bw;
          const y = by + Math.sin(t * Math.PI * 6 + 0.5) * waveAmp;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        // Right edge (top to bottom)
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = bx + bw + Math.sin(t * Math.PI * 6 + 1.5) * waveAmp;
          const y = by + t * bh;
          ctx.lineTo(x, y);
        }

        // Bottom edge (right to left)
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = bx + bw - t * bw;
          const y = by + bh + Math.sin(t * Math.PI * 6 + 2.5) * waveAmp;
          ctx.lineTo(x, y);
        }

        // Left edge (bottom to top)
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const x = bx + Math.sin(t * Math.PI * 6 + 3.5) * waveAmp;
          const y = by + bh - t * bh;
          ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.stroke();

        // Step 5: Chanv icon in center — just the icon, no extra border
        const icon = new Image();
        icon.crossOrigin = "anonymous";
        icon.src = "/favicon.svg";

        icon.onload = () => {
          // White background circle (no stroke)
          const logoR = canvasSize * 0.138;
          ctx.beginPath();
          ctx.arc(center, center, logoR, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();

          // Draw icon
          const iconSize = logoR * 1.8;
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
