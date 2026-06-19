"use client";

import { useState } from "react";
import { SensorReadingsPanel } from "./panels/SensorReadingsPanel";
import { EmployeesPanel } from "./panels/EmployeesPanel";
import { DevicesPanel } from "./panels/DevicesPanel";
import { EquipmentPanel } from "./panels/EquipmentPanel";
import { RoomHistoryTimeline } from "./panels/RoomHistoryTimeline";
import { RoomStatsPanel } from "./panels/RoomStatsPanel";
import { Thermometer, Users, Wifi, Wrench, Clock, BarChart3 } from "lucide-react";

const TABS = [
  { key: "capteurs", label: "Capteurs", icon: Thermometer },
  { key: "employes", label: "Employés", icon: Users },
  { key: "appareils", label: "Appareils", icon: Wifi },
  { key: "equipements", label: "Équipements", icon: Wrench },
  { key: "historique", label: "Historique", icon: Clock },
  { key: "stats", label: "Statistiques", icon: BarChart3 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface SalleTabsProps {
  usineId: string;
  salleId: string;
}

export function SalleTabs({ usineId, salleId }: SalleTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("capteurs");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-chanv-fibre" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
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
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div>
        {activeTab === "capteurs" && <SensorReadingsPanel usineId={usineId} salleId={salleId} />}
        {activeTab === "employes" && <EmployeesPanel usineId={usineId} salleId={salleId} />}
        {activeTab === "appareils" && <DevicesPanel usineId={usineId} salleId={salleId} />}
        {activeTab === "equipements" && <EquipmentPanel usineId={usineId} salleId={salleId} />}
        {activeTab === "historique" && <RoomHistoryTimeline usineId={usineId} salleId={salleId} />}
        {activeTab === "stats" && <RoomStatsPanel usineId={usineId} salleId={salleId} />}
      </div>
    </div>
  );
}
