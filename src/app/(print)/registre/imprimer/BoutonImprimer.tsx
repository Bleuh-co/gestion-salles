"use client";

import { Printer } from "lucide-react";

export function BoutonImprimer({ libelle, aide }: { libelle: string; aide: string }) {
  return (
    <div className="registre-outils">
      <button type="button" onClick={() => window.print()}>
        <Printer style={{ width: 16, height: 16 }} />
        {libelle}
      </button>
      <span>{aide}</span>
    </div>
  );
}
