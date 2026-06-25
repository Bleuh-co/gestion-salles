"use client";

import { PrintableRoomSign } from "@/components/PrintableRoomSign";
import type { Local } from "@/lib/types";

export function SignPageClient({ local }: { local: Local }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const targetUrl = `${origin}/salles/${encodeURIComponent(local.id)}`;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center py-12 print:py-0 print:bg-white">
      <PrintableRoomSign local={local} targetUrl={targetUrl} />
    </div>
  );
}
