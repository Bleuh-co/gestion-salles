"use client";

import { useEffect, useState } from "react";
import { PrintableQRCode } from "@/components/PrintableQRCode";
import { Loader2 } from "lucide-react";
import type { Salle } from "@/lib/types";
import { useParams } from "next/navigation";

export default function SalleQRPage() {
  const params = useParams<{ usineId: string; salleId: string }>();
  const { usineId, salleId } = params;
  const [salle, setSalle] = useState<Pick<Salle, "id" | "nom" | "usineId" | "type"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/usines/${usineId}/salles/${salleId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Salle introuvable");
        return r.json();
      })
      .then((data) => setSalle({ id: data.id, nom: data.nom, usineId: data.usineId, type: data.type }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [usineId, salleId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const targetUrl = `${origin}/usines/${usineId}/salles/${salleId}`;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-chanv-beige" />
      </main>
    );
  }

  if (error || !salle) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center text-red-500">
          <p className="text-lg font-bold">Erreur</p>
          <p className="text-sm mt-2">{error || "Salle introuvable"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <PrintableQRCode salle={salle} targetUrl={targetUrl} />
    </main>
  );
}
