"use client";

import type { LocalStatut } from "@/lib/types";
import { LOCAL_STATUT_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<LocalStatut, string> = {
  en_service: "bg-green-100 text-green-800",
  en_construction: "bg-amber-100 text-amber-800",
  hors_service: "bg-red-100 text-red-800",
  en_qualification: "bg-blue-100 text-blue-800",
};

interface LocalStatusBadgeProps {
  status: LocalStatut;
  size?: "sm" | "md";
}

export function LocalStatusBadge({ status, size = "md" }: LocalStatusBadgeProps) {
  return (
    <span className={`badge ${STATUS_STYLES[status]} ${size === "sm" ? "text-[10px] px-1.5 py-0.5" : ""}`}>
      {LOCAL_STATUT_LABELS[status]}
    </span>
  );
}
