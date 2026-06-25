"use client";

import { PrintableRoomSign } from "@/components/PrintableRoomSign";
import type { Local } from "@/lib/types";

export function SignPageClient({ local }: { local: Local }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const targetUrl = `${origin}/salles/${encodeURIComponent(local.id)}`;

  return <PrintableRoomSign local={local} targetUrl={targetUrl} />;
}
