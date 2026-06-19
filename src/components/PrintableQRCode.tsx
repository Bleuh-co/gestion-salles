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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function generate() {
      try {
        const size = 600;
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Generate QR code onto canvas
        await QRCode.toCanvas(canvas, targetUrl, {
          width: size,
          margin: 2,
          color: { dark: "#282828", light: "#FFFFFF" },
          errorCorrectionLevel: "H", // High correction to allow logo overlay
        });

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Load Chanv logo
        const logo = new Image();
        logo.crossOrigin = "anonymous";
        logo.src = "/favicon.svg";

        logo.onload = () => {
          // White circle background for the logo
          const logoSize = size * 0.22;
          const padding = logoSize * 0.15;
          const cx = (size - logoSize) / 2;
          const cy = (size - logoSize) / 2;

          // Draw white circle with slight shadow effect
          ctx.beginPath();
          ctx.arc(size / 2, size / 2, (logoSize + padding) / 2, 0, Math.PI * 2);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = "#E8E8E8";
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw the logo
          ctx.drawImage(logo, cx, cy, logoSize, logoSize);

          // Export final result
          setFinalDataUrl(canvas.toDataURL("image/png"));
        };

        logo.onerror = () => {
          // If logo fails, just use the QR as-is
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
