"use client";

import { useState } from "react";
import { Wrench, Info, Thermometer, Wifi, WifiOff, Battery, Clock } from "lucide-react";
import type { Actif, SensorReading } from "@/lib/types";
import { ActifsTable } from "./ActifsTable";

const TABS = [
  { key: "infos", label: "Informations", icon: Info },
  { key: "actifs", label: "Actifs", icon: Wrench },
  { key: "capteurs", label: "Capteurs", icon: Thermometer },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface SalleTabsProps {
  children: React.ReactNode; // infos panel (server rendered)
  actifs: Actif[];
  sensors?: SensorReading[];
}

function formatTimeAgo(utcStr: string | null): string {
  if (!utcStr) return "—";
  const diff = Date.now() - new Date(utcStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export function SalleTabs({ children, actifs, sensors = [] }: SalleTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("infos");

  // Only show capteurs tab if sensors exist
  const visibleTabs = sensors.length > 0 ? TABS : TABS.filter((t) => t.key !== "capteurs");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-chanv-fibre" role="tablist">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count =
            tab.key === "actifs" ? actifs.length :
            tab.key === "capteurs" ? sensors.length :
            undefined;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl whitespace-nowrap transition-all ${
                isActive
                  ? "bg-chanv-fibre text-chanv-terre border-b-2 border-chanv-beige -mb-px"
                  : "text-slate-500 hover:text-chanv-terre hover:bg-chanv-fibre/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-chanv-terre/10 text-chanv-terre font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "infos" && children}
        {activeTab === "actifs" && <ActifsTable actifs={actifs} />}
        {activeTab === "capteurs" && <SensorPanel sensors={sensors} />}
      </div>
    </div>
  );
}

// ============================================================
// Sensor Panel — displays sensor readings for a room
// ============================================================

function SensorPanel({ sensors }: { sensors: SensorReading[] }) {
  if (sensors.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-400">
        Aucun capteur associé à cette salle.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {sensors.map((sensor) => (
        <SensorCard key={sensor.sensor_id} sensor={sensor} />
      ))}
    </div>
  );
}

function SensorCard({ sensor }: { sensor: SensorReading }) {
  const isOnline = !sensor.offline;

  return (
    <div className="section-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: isOnline
              ? "linear-gradient(135deg, #22c55e20, #22c55e10)"
              : "linear-gradient(135deg, #ef444420, #ef444410)",
            border: `1.5px solid ${isOnline ? "#22c55e30" : "#ef444430"}`,
          }}
        >
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-500" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-chanv-terre truncate">
            {sensor.sensor_name || sensor.sensor_id}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: isOnline ? "#22c55e15" : "#ef444415",
                color: isOnline ? "#16a34a" : "#dc2626",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isOnline ? "#22c55e" : "#ef4444" }}
              />
              {isOnline ? "En ligne" : "Hors ligne"}
            </span>
            <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded-full bg-chanv-fibre font-medium">
              {sensor.match_source === "override" ? "Override admin" : "Auto-match"}
            </span>
          </div>
        </div>
      </div>

      {/* Readings */}
      <div className="grid grid-cols-2 gap-3">
        {/* Temperature */}
        <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-xl p-3 border border-rose-100">
          <div className="text-[10px] uppercase tracking-wider text-rose-400 font-semibold mb-1">
            Température
          </div>
          <div className="text-2xl font-bold text-rose-600">
            {sensor.last_temp_c != null ? `${sensor.last_temp_c.toFixed(1)}°` : "—"}
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-100">
          <div className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold mb-1">
            Humidité
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {sensor.last_humidity != null ? `${Math.round(sensor.last_humidity)}%` : "—"}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-chanv-fibre/50">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatTimeAgo(sensor.last_checkin_utc)}
        </div>
        {sensor.battery != null && (
          <div className="flex items-center gap-1">
            <Battery className="w-3 h-3" />
            {Math.round(sensor.battery)}%
          </div>
        )}
      </div>
    </div>
  );
}
