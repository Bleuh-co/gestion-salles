"use client";

import { useEffect, useState } from "react";
import type { RoomStats } from "@/lib/types";
import { Loader2, Activity, AlertTriangle, Wrench, Users, Thermometer, Droplets } from "lucide-react";

interface RoomStatsPanelProps {
  usineId: string;
  salleId: string;
}

function Sparkline({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  if (data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200;
  const h = 50;
  const padding = 4;

  const points = data
    .map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (w - padding * 2);
      const y = h - padding - ((d.value - min) / range) * (h - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (w - padding * 2);
        const y = h - padding - ((d.value - min) / range) * (h - padding * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}

export function RoomStatsPanel({ usineId, salleId }: RoomStatsPanelProps) {
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/usines/${usineId}/salles/${salleId}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [usineId, salleId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-chanv-beige" /></div>;
  }

  if (!stats) {
    return <div className="text-center py-12 text-sm text-slate-400">Aucune statistique disponible.</div>;
  }

  const kpis = [
    { icon: Activity, label: "Uptime", value: `${stats.uptimePct}%`, color: "text-green-600" },
    { icon: AlertTriangle, label: "Alertes 30j", value: String(stats.alertes30j), color: "text-amber-600" },
    { icon: Wrench, label: "Interventions 30j", value: String(stats.interventions30j), color: "text-blue-600" },
    { icon: Users, label: "Occupation moy.", value: `${stats.occupationMoyenne}%`, color: "text-violet-600" },
    { icon: Thermometer, label: "Temp. moy.", value: `${stats.tempMoyenne}°C`, color: "text-orange-600" },
    { icon: Droplets, label: "Humidité moy.", value: `${stats.humiditeMoyenne}%`, color: "text-cyan-600" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="section-card p-4 text-center">
              <Icon className={`w-5 h-5 mx-auto mb-2 ${kpi.color}`} />
              <div className="text-2xl font-bold text-chanv-terre">{kpi.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-1">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      {/* Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="section-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Thermometer className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-chanv-terre">Tendance température</span>
          </div>
          <Sparkline data={stats.trendTemp} color="#f97316" />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
            {stats.trendTemp.map((d) => (
              <span key={d.label}>{d.label}</span>
            ))}
          </div>
        </div>

        <div className="section-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Droplets className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-semibold text-chanv-terre">Tendance humidité</span>
          </div>
          <Sparkline data={stats.trendHumidite} color="#06b6d4" />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
            {stats.trendHumidite.map((d) => (
              <span key={d.label}>{d.label}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
