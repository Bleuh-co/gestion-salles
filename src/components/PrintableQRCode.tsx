"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, Loader2 } from "lucide-react";
import type { Salle } from "@/lib/types";

interface PrintableQRCodeProps {
  salle: Pick<Salle, "id" | "nom" | "usineId" | "type">;
  targetUrl: string;
}

export function PrintableQRCode({ salle, targetUrl }: PrintableQRCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(targetUrl, {
      width: 300,
      margin: 2,
      color: { dark: "#282828", light: "#FFFFFF" },
    })
      .then(setDataUrl)
      .catch(() => setError("Erreur de génération du QR code"));
  }, [targetUrl]);

  if (error) {
    return <div className="text-center py-12 text-red-500 text-sm">{error}</div>;
  }

  if (!dataUrl) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Génération du QR…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-chanv-terre">{salle.nom}</h1>
        <p className="text-sm text-slate-500">{salle.type}</p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`QR code pour ${salle.nom}`}
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
