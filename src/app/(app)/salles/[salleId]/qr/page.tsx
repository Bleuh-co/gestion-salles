"use client";

import { useParams } from "next/navigation";
import { PrintableQRCode } from "@/components/PrintableQRCode";

export default function QRPage() {
  const params = useParams<{ salleId: string }>();
  const salleId = decodeURIComponent(params.salleId);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const targetUrl = `${origin}/salles/${encodeURIComponent(salleId)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <PrintableQRCode localId={salleId} targetUrl={targetUrl} />
    </div>
  );
}
