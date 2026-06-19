"use client";

const LEGEND_ITEMS = [
  { label: "Normal", color: "#22c55e" },
  { label: "Alerte", color: "#f59e0b" },
  { label: "Maintenance", color: "#3b82f6" },
  { label: "Hors service", color: "#ef4444" },
];

export function FloorPlanLegend() {
  return (
    <div className="flex flex-wrap gap-4 items-center mt-4">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block w-4 h-4 rounded-full border border-black/10"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-slate-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
