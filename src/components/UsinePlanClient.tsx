"use client";

import { useState } from "react";
import type { Usine } from "@/lib/types";
import { FactoryFloorPlan } from "./FactoryFloorPlan";
import { FloorPlanLegend } from "./FloorPlanLegend";
import { RoomDrawer } from "./RoomDrawer";

interface UsinePlanClientProps {
  usine: Usine;
}

export function UsinePlanClient({ usine }: UsinePlanClientProps) {
  const [selectedSalleId, setSelectedSalleId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <FactoryFloorPlan
        salles={usine.salles}
        selectedSalleId={selectedSalleId}
        onSelectSalle={(id) => setSelectedSalleId(id)}
      />

      <FloorPlanLegend />

      <RoomDrawer
        usineId={usine.id}
        salleId={selectedSalleId}
        onClose={() => setSelectedSalleId(null)}
      />
    </div>
  );
}
