"use client";

import { useState } from "react";
import type { Local } from "@/lib/types";
import { SallesListClient } from "./SallesListClient";
import { FloorPlanView } from "./FloorPlanView";
import {
  Building, CheckCircle, HardHat, XCircle, ClipboardCheck,
  Map, List
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props {
  locaux: Local[];
  familles: string[];
  etages: string[];
  isAdmin?: boolean;
  familleColors: Record<string, string>;
  stats: {
    total: number;
    enService: number;
    enConstruction: number;
    horsService: number;
    enQualification: number;
  };
}

export function SallesPageClient({ locaux, familles, etages, stats, isAdmin, familleColors }: Props) {
  const t = useT();
  const [view, setView] = useState<"plan" | "list">("plan");

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-chanv-terre">{t("salles.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t("salles.subtitle", { count: stats.total })}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-chanv-fibre rounded-xl p-1">
          <button
            onClick={() => setView("plan")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              view === "plan"
                ? "bg-chanv-terre text-white shadow-md"
                : "text-slate-500 hover:text-chanv-terre"
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            {t("salles.viewPlan")}
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              view === "list"
                ? "bg-chanv-terre text-white shadow-md"
                : "text-slate-500 hover:text-chanv-terre"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            {t("salles.viewList")}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard icon={<Building className="w-4 h-4" />} label={t("salles.statTotal")} value={stats.total} color="text-chanv-terre" />
        <StatCard icon={<CheckCircle className="w-4 h-4" />} label={t("status.en_service")} value={stats.enService} color="text-green-600" />
        <StatCard icon={<HardHat className="w-4 h-4" />} label={t("status.en_construction")} value={stats.enConstruction} color="text-amber-600" />
        <StatCard icon={<XCircle className="w-4 h-4" />} label={t("status.hors_service")} value={stats.horsService} color="text-red-600" />
        <StatCard icon={<ClipboardCheck className="w-4 h-4" />} label={t("status.en_qualification")} value={stats.enQualification} color="text-blue-600" />
      </div>

      {/* Content */}
      {view === "plan" ? (
        <FloorPlanView locaux={locaux} isAdmin={isAdmin} familleColors={familleColors} />
      ) : (
        <SallesListClient locaux={locaux} familles={familles} etages={etages} familleColors={familleColors} />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card p-3 flex items-center gap-3">
      <div className={`${color}`}>{icon}</div>
      <div>
        <div className={`text-xl font-bold ${color}`}>{value}</div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
      </div>
    </div>
  );
}
