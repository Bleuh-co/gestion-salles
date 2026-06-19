"use client";

import { useEffect, useState } from "react";
import type { HistoryEvent } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Loader2 } from "lucide-react";

const TYPE_DOT: Record<string, string> = {
  info: "bg-blue-400",
  alerte: "bg-amber-400",
  maintenance: "bg-violet-400",
  intervention: "bg-green-400",
};

const TYPE_LABELS: Record<string, string> = {
  info: "Info",
  alerte: "Alerte",
  maintenance: "Maintenance",
  intervention: "Intervention",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) +
    " à " +
    d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

interface RoomHistoryTimelineProps {
  usineId: string;
  salleId: string;
}

export function RoomHistoryTimeline({ usineId, salleId }: RoomHistoryTimelineProps) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/usines/${usineId}/salles/${salleId}/history`)
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [usineId, salleId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-chanv-beige" /></div>;
  }

  if (events.length === 0) {
    return <EmptyState icon="📜" title="Aucun historique" description="Aucun événement enregistré pour cette salle." />;
  }

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-chanv-fibre" />

      <div className="space-y-6">
        {events.map((event) => (
          <div key={event.id} className="relative flex gap-4">
            {/* Dot */}
            <div className={`absolute -left-6 top-1 w-[10px] h-[10px] rounded-full border-2 border-white ${TYPE_DOT[event.type] || TYPE_DOT.info}`} />

            <div className="flex-1 section-card p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-chanv-terre text-sm">{event.titre}</span>
                  <span className="badge-neutral text-[10px]">{TYPE_LABELS[event.type]}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>
              <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                <span>Par {event.auteur}</span>
                <span>{formatTimestamp(event.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
