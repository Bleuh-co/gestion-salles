"use client";

import { useParams, useRouter } from "next/navigation";
import { PrintableQRCode } from "@/components/PrintableQRCode";
import { ArrowLeft } from "lucide-react";

export default function QRPage() {
  const params = useParams<{ salleId: string }>();
  const router = useRouter();
  const salleId = decodeURIComponent(params.salleId);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const targetUrl = `${origin}/salles/${encodeURIComponent(salleId)}`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative">
      <button
        onClick={() => router.back()}
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-slate-500 hover:text-chanv-terre transition-colors print:hidden"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>
      <PrintableQRCode localId={salleId} targetUrl={targetUrl} />
    </div>
  );
}

