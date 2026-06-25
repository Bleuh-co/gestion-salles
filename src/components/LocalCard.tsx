"use client";

import Link from "next/link";
import type { Local } from "@/lib/types";
import { FAMILLE_COLORS, FAMILLE_SHORT } from "@/lib/types";
import { LocalStatusBadge } from "./LocalStatusBadge";
import { DoorOpen, Thermometer, Shield, Users, Droplets, Wifi, WifiOff } from "lucide-react";

interface SensorData {
  temp: number | null;
  humidity: number | null;
  offline: boolean;
}

interface LocalCardProps {
  local: Local;
  assignedCount?: number;
  sensorData?: SensorData;
}

export function LocalCard({ local, assignedCount, sensorData }: LocalCardProps) {
  const familleColor = FAMILLE_COLORS[local.famille] || "#94a3b8";
  const familleShort = FAMILLE_SHORT[local.famille] || local.idLicence;

  return (
    <Link
      href={`/salles/${encodeURIComponent(local.id)}`}
      className="card p-5 flex flex-col gap-3 hover:shadow-[var(--shadow-bold)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: familleColor }}
          >
            {familleShort}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-chanv-terre text-sm leading-tight truncate">
              {local.nomSalle || local.id}
            </h3>
            {local.nomSalle && (
              <p className="text-xs text-slate-400 truncate">{local.id}</p>
            )}
          </div>
        </div>
        <LocalStatusBadge status={local.statut} size="sm" />
      </div>

      {/* Vocation */}
      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
        {local.vocation || "—"}
      </p>

      {/* Sensor data */}
      {sensorData && (
        <div className="flex items-center gap-3 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
          {sensorData.offline ? (
            <span className="flex items-center gap-1.5 text-[11px] text-red-400 font-medium">
              <WifiOff className="w-3 h-3" />
              Capteur hors ligne
            </span>
          ) : (
            <>
              {sensorData.temp !== null && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                  <Thermometer className="w-3 h-3" />
                  {sensorData.temp.toFixed(1)}°C
                </span>
              )}
              {sensorData.humidity !== null && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-500">
                  <Droplets className="w-3 h-3" />
                  {sensorData.humidity.toFixed(0)}%
                </span>
              )}
              <span className="flex items-center gap-1 ml-auto text-[10px] text-green-500">
                <Wifi className="w-3 h-3" />
              </span>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 pt-2 border-t border-chanv-fibre mt-auto text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <DoorOpen className="w-3 h-3" />
          {local.etage}
        </span>
        <span className="flex items-center gap-1">
          <Thermometer className="w-3 h-3" />
          {local.conditions || "—"}
        </span>
        {local.niveauAcces && local.niveauAcces !== "Employés" && (
          <span className="flex items-center gap-1 text-amber-600">
            <Shield className="w-3 h-3" />
            {local.niveauAcces}
          </span>
        )}
        {assignedCount !== undefined && assignedCount > 0 && (
          <span className="flex items-center gap-1 ml-auto text-green-600 font-semibold">
            <Users className="w-3 h-3" />
            {assignedCount}
          </span>
        )}
      </div>
    </Link>
  );
}
