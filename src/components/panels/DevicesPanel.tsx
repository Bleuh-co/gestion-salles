"use client";

import { useEffect, useState } from "react";
import type { Device } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Wifi, WifiOff, AlertCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { icon: typeof Wifi; color: string; label: string }> = {
  online: { icon: Wifi, color: "text-green-500", label: "En ligne" },
  offline: { icon: WifiOff, color: "text-slate-400", label: "Hors ligne" },
  erreur: { icon: AlertCircle, color: "text-red-500", label: "Erreur" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs}h`;
  return `il y a ${Math.floor(hrs / 24)}j`;
}

interface DevicesPanelProps {
  usineId: string;
  salleId: string;
}

export function DevicesPanel({ usineId, salleId }: DevicesPanelProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/usines/${usineId}/salles/${salleId}/devices`)
      .then((r) => r.json())
      .then(setDevices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [usineId, salleId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-chanv-beige" /></div>;
  }

  if (devices.length === 0) {
    return <EmptyState icon="📶" title="Aucun appareil" description="Aucun device IoT dans cette salle." />;
  }

  return (
    <div className="space-y-3">
      {devices.map((dev) => {
        const cfg = STATUS_CONFIG[dev.status] || STATUS_CONFIG.offline;
        const Icon = cfg.icon;
        return (
          <div key={dev.id} className="section-card p-4 flex items-center gap-4">
            <div className={`shrink-0 ${cfg.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-chanv-terre text-sm truncate">{dev.nom}</div>
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 mt-1">
                <span>{dev.type}</span>
                {dev.ipAddress && <span className="font-mono">{dev.ipAddress}</span>}
                {dev.firmware && <span>{dev.firmware}</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className={`badge text-xs ${dev.status === "online" ? "bg-green-100 text-green-700" : dev.status === "erreur" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"}`}>
                {cfg.label}
              </span>
              <div className="text-[10px] text-slate-400 mt-1">{timeAgo(dev.lastSeen)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
