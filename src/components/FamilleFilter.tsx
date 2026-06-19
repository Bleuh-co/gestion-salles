"use client";

import { FAMILLE_COLORS } from "@/lib/types";

interface FamilleFilterProps {
  familles: string[];
  selected: string | null;
  onSelect: (famille: string | null) => void;
}

export function FamilleFilter({ familles, selected, onSelect }: FamilleFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
          selected === null
            ? "bg-chanv-terre text-white shadow-md"
            : "bg-chanv-fibre text-slate-600 hover:bg-chanv-beige/30"
        }`}
      >
        Tous
      </button>
      {familles.map((f) => {
        const color = FAMILLE_COLORS[f] || "#94a3b8";
        const isActive = selected === f;
        return (
          <button
            key={f}
            onClick={() => onSelect(isActive ? null : f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              isActive
                ? "text-white shadow-md border-transparent"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
            style={isActive ? { backgroundColor: color } : undefined}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: color }}
            />
            {f}
          </button>
        );
      })}
    </div>
  );
}
