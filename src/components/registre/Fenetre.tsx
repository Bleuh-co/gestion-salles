"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

// ============================================================
// Fenêtre (modale) des gestes du registre — même allure que les
// formulaires d'actif et de salle de l'app.
// ============================================================

export function Fenetre({
  titre,
  sousTitre,
  onClose,
  children,
  pied,
  large = false,
}: {
  titre: React.ReactNode;
  sousTitre?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  pied?: React.ReactNode;
  large?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className={`w-full ${large ? "max-w-2xl" : "max-w-lg"} bg-white rounded-2xl shadow-2xl my-4`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-chanv-fibre">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-chanv-terre">{titre}</h2>
            {sousTitre && <p className="text-[11px] text-slate-400">{sousTitre}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-chanv-terre rounded-lg hover:bg-chanv-fibre/50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        {pied && <div className="px-6 py-4 border-t border-chanv-fibre flex flex-wrap items-center justify-end gap-2">{pied}</div>}
      </div>
    </div>
  );
}

export function Champ({ libelle, children, aide }: { libelle: React.ReactNode; children: React.ReactNode; aide?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 mb-1">{libelle}</span>
      {children}
      {aide && <span className="block text-[11px] text-slate-400 mt-1">{aide}</span>}
    </label>
  );
}

export const CLASSE_CHAMP =
  "w-full text-sm border border-chanv-fibre rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-chanv-beige/50";
