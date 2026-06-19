"use client";

import { useEffect, useState } from "react";
import type { SensorReading } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { Thermometer, Droplets, Wind, Gauge, Loader2 } from "lucide-react";

const SENSOR_ICONS: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  humidite: Droplets,
  co2: Wind,
  pression: Gauge,
};

const STATUS_COLORS: Record<string, string> = {
  ok: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

interface SensorReadingsPanelProps {
  usineId: string;
  salleId: string;
}

export function SensorReadingsPanel({ usineId, salleId }: SensorReadingsPanelProps) {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/usines/${usineId}/salles/${salleId}/readings`)
      .then((r) => r.json())
      .then(setReadings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [usineId, salleId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-chanv-beige" />
      </div>
    );
  }

  if (readings.length === 0) {
    return <EmptyState icon="📡" title="Aucun capteur" description="Aucune lecture de capteur disponible pour cette salle." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {readings.map((r) => {
        const Icon = SENSOR_ICONS[r.type] || Gauge;
        const pct = Math.min(100, Math.max(0, ((r.value - r.min) / (r.max - r.min)) * 100));

        return (
          <div key={r.id} className="section-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-chanv-terre" />
                <span className="text-sm font-semibold text-chanv-terre">{r.label}</span>
              </div>
              <span className={`badge text-xs ${STATUS_COLORS[r.status]}`}>
                {r.status === "ok" ? "OK" : r.status === "warning" ? "Attention" : "Critique"}
              </span>
            </div>

            <div className="text-3xl font-bold text-chanv-terre">
              {r.value}
              <span className="text-base font-normal text-slate-400 ml-1">{r.unit}</span>
            </div>

            {/* Progress bar */}
            <div className="space-y-1">
              <div className="w-full h-2 bg-chanv-fibre rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: r.status === "ok" ? "#22c55e" : r.status === "warning" ? "#f59e0b" : "#ef4444",
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{r.min}{r.unit}</span>
                <span>{r.max}{r.unit}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
