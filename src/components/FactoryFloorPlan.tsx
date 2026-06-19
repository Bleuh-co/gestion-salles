"use client";

import type { Salle, RoomStatus } from "@/lib/types";

const STATUS_FILL: Record<RoomStatus, string> = {
  normal: "#22c55e",
  alerte: "#f59e0b",
  maintenance: "#3b82f6",
  hors_service: "#ef4444",
};

interface FactoryFloorPlanProps {
  salles: Salle[];
  selectedSalleId: string | null;
  onSelectSalle: (salleId: string) => void;
}

export function FactoryFloorPlan({ salles, selectedSalleId, onSelectSalle }: FactoryFloorPlanProps) {
  return (
    <svg
      viewBox="0 0 800 500"
      className="w-full h-auto border border-chanv-fibre rounded-2xl bg-white"
      style={{ maxHeight: "500px" }}
    >
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1eada" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="800" height="500" fill="url(#grid)" />

      {salles.map((salle) => {
        const { x, y, width, height } = salle.floorPlan;
        const isSelected = salle.id === selectedSalleId;
        const fill = STATUS_FILL[salle.statut];

        return (
          <g
            key={salle.id}
            onClick={() => onSelectSalle(salle.id)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`Salle ${salle.nom}`}
          >
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              rx={8}
              fill={fill}
              fillOpacity={isSelected ? 0.9 : 0.6}
              stroke={isSelected ? "#282828" : fill}
              strokeWidth={isSelected ? 3 : 1.5}
              className="transition-all duration-200 hover:fill-opacity-80"
            />
            <text
              x={x + width / 2}
              y={y + height / 2 - 8}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-xs font-bold fill-chanv-terre pointer-events-none select-none"
              style={{ fontSize: "12px" }}
            >
              {salle.nom}
            </text>
            <text
              x={x + width / 2}
              y={y + height / 2 + 10}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-chanv-terre/60 pointer-events-none select-none"
              style={{ fontSize: "10px" }}
            >
              {salle.type} · {salle.superficie}m²
            </text>
          </g>
        );
      })}
    </svg>
  );
}
