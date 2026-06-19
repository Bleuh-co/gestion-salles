"use client";

import Link from "next/link";
import type { Usine } from "@/lib/types";
import { RoomStatusBadge } from "./RoomStatusBadge";
import { Factory, MapPin, DoorOpen } from "lucide-react";

interface UsineCardProps {
  usine: Pick<Usine, "id" | "nom" | "localisation" | "statutGlobal" | "nbSalles">;
}

export function UsineCard({ usine }: UsineCardProps) {
  return (
    <Link
      href={`/usines/${usine.id}`}
      className="card p-6 flex flex-col gap-3 hover:shadow-[var(--shadow-bold)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-chanv-fibre flex items-center justify-center group-hover:bg-chanv-beige/30 transition-colors">
            <Factory className="w-5 h-5 text-chanv-terre" />
          </div>
          <div>
            <h3 className="font-bold text-chanv-terre text-base leading-tight">{usine.nom}</h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              <span>{usine.localisation}</span>
            </div>
          </div>
        </div>
        <RoomStatusBadge status={usine.statutGlobal} />
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-chanv-fibre mt-auto">
        <DoorOpen className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-600">
          <strong className="text-chanv-terre">{usine.nbSalles}</strong> salle{usine.nbSalles > 1 ? "s" : ""}
        </span>
      </div>
    </Link>
  );
}
