"use client";

import type { RoomStatus } from "@/lib/types";
import { ROOM_STATUS_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<RoomStatus, string> = {
  normal: "bg-green-100 text-green-800",
  alerte: "bg-amber-100 text-amber-800",
  maintenance: "bg-blue-100 text-blue-800",
  hors_service: "bg-red-100 text-red-800",
};

interface RoomStatusBadgeProps {
  status: RoomStatus;
}

export function RoomStatusBadge({ status }: RoomStatusBadgeProps) {
  return (
    <span
      className={`badge ${STATUS_STYLES[status]}`}
    >
      {ROOM_STATUS_LABELS[status]}
    </span>
  );
}
