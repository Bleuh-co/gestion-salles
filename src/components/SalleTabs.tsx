"use client";

import { useState } from "react";
import { Wrench, Info } from "lucide-react";
import type { Actif } from "@/lib/types";
import { ActifsTable } from "./ActifsTable";

const TABS = [
  { key: "infos", label: "Informations", icon: Info },
  { key: "actifs", label: "Actifs", icon: Wrench },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface SalleTabsProps {
  children: React.ReactNode; // infos panel (server rendered)
  actifs: Actif[];
}

export function SalleTabs({ children, actifs }: SalleTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("infos");

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-chanv-fibre" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count = tab.key === "actifs" ? actifs.length : undefined;
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
      </div>
    </div>
  );
}
