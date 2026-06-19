"use client";

import type { RoomSummary } from "@/lib/types";
import { RoomStatusBadge } from "./RoomStatusBadge";
import { Users, Wifi, AlertTriangle, Thermometer, Droplets } from "lucide-react";

interface RoomSynthesisCardProps {
  summary: RoomSummary;
}

export function RoomSynthesisCard({ summary }: RoomSynthesisCardProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-chanv-terre">{summary.nom}</h3>
        <RoomStatusBadge status={summary.statut} />
      </div>

      <p className="text-sm text-slate-500">{summary.type}</p>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-chanv-fibre/50 rounded-xl p-3 text-center">
          <Users className="w-4 h-4 mx-auto mb-1 text-slate-500" />
          <div className="text-lg font-bold text-chanv-terre">{summary.nbEmployes}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Présents</div>
        </div>
        <div className="bg-chanv-fibre/50 rounded-xl p-3 text-center">
          <Wifi className="w-4 h-4 mx-auto mb-1 text-slate-500" />
          <div className="text-lg font-bold text-chanv-terre">
            {summary.nbDevicesOnline}/{summary.nbDevicesTotal}
          </div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Devices</div>
        </div>
        <div className="bg-chanv-fibre/50 rounded-xl p-3 text-center">
          <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-slate-500" />
          <div className="text-lg font-bold text-chanv-terre">{summary.nbAlertes}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Alertes</div>
        </div>
      </div>

      {summary.capteursCles.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Capteurs clés</div>
          {summary.capteursCles.map((c) => (
            <div key={c.id} className="flex items-center justify-between bg-chanv-fibre/30 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                {c.type === "temperature" ? (
                  <Thermometer className="w-4 h-4 text-orange-500" />
                ) : (
                  <Droplets className="w-4 h-4 text-blue-500" />
                )}
                <span className="text-sm text-slate-600">{c.label}</span>
              </div>
              <span className="text-sm font-bold text-chanv-terre">
                {c.value}{c.unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
