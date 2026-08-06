"use client";

import type { ItemAgricole } from "@/lib/types";
import { EmptyState } from "./EmptyState";
import { ExternalLink, ShoppingCart } from "lucide-react";

interface ItemsAgricolesTableProps {
  items: ItemAgricole[];
  achatUrl: string;
  salleId: string;
}

function buildCommanderUrl(item: ItemAgricole, achatUrl: string, salleId: string): string {
  const description = [item.name, item.description, `(salle ${salleId})`]
    .filter(Boolean)
    .join(" — ");
  const params = new URLSearchParams({
    description,
    quantite: "1",
    division: "Ferme",
  });
  if (item.link) params.set("lien", item.link);
  return `${achatUrl}/achat?${params.toString()}`;
}

export function ItemsAgricolesTable({ items, achatUrl, salleId }: ItemsAgricolesTableProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="🌱"
        title="Aucun item agricole"
        description="Aucun item agricole lié à cette salle."
      />
    );
  }

  return (
    <div className="section-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chanv-fibre text-left">
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">SKU</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Nom</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Description</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Fournisseur</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">Lien</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-chanv-fibre/50 hover:bg-chanv-fibre/20 transition-colors"
              >
                <td className="px-4 py-3">
                  <span className="text-[11px] text-slate-400 font-mono">{item.sku || "—"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-chanv-terre">{item.name}</div>
                  {item.countingUnit && (
                    <div className="text-[11px] text-slate-400">{item.countingUnit}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.description || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{item.supplierName || "—"}</td>
                <td className="px-4 py-3">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-chanv-terre hover:underline"
                      title="Ouvrir le lien produit"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={buildCommanderUrl(item, achatUrl, salleId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost inline-flex items-center gap-2 border border-chanv-fibre text-xs whitespace-nowrap"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Commander
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
