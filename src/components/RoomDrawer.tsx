"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RoomSummary } from "@/lib/types";
import { RoomSynthesisCard } from "./RoomSynthesisCard";
import { X, ExternalLink, Loader2 } from "lucide-react";

interface RoomDrawerProps {
  usineId: string;
  salleId: string | null;
  onClose: () => void;
}

export function RoomDrawer({ usineId, salleId, onClose }: RoomDrawerProps) {
  const [summary, setSummary] = useState<RoomSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salleId) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/usines/${usineId}/salles/${salleId}/summary`)
      .then((res) => {
        if (!res.ok) throw new Error("Salle introuvable");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [usineId, salleId]);

  const isOpen = salleId !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-xl z-50 transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-chanv-fibre">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Résumé salle</h2>
          <button onClick={onClose} className="btn-ghost p-2 rounded-full" title="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-chanv-beige" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-sm text-red-500">{error}</div>
          )}

          {!loading && !error && summary && <RoomSynthesisCard summary={summary} />}
        </div>

        {/* Footer */}
        {summary && !loading && (
          <div className="px-6 py-4 border-t border-chanv-fibre">
            <Link
              href={`/usines/${usineId}/salles/${salleId}`}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Voir fiche complète
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
