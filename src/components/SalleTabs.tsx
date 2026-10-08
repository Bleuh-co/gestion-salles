"use client";

import { useEffect, useRef, useState } from "react";
import { Wrench, Info, Thermometer, Sprout, History, Hammer } from "lucide-react";
import type { Actif, ItemAgricole, SensorReading } from "@/lib/types";
import { ItemsAgricolesTable } from "./ItemsAgricolesTable";
import { ActifsSalle, type ActifLigne } from "./registre/ActifsSalle";
import { CapteursTab } from "./registre/CapteursTab";
import { RegistreTab, type FiltreCible } from "./registre/RegistreTab";
import { ExportDialog, type SalleChoix } from "./registre/ExportDialog";
import { ResumeTerrain } from "./registre/ResumeTerrain";
import { EntretienSalle } from "./entretien/EntretienSalle";
import { useT } from "@/lib/i18n";

const TABS = [
  { key: "infos", labelKey: "tabs.infos", icon: Info },
  { key: "actifs", labelKey: "tabs.actifs", icon: Wrench },
  { key: "items-agricoles", labelKey: "tabs.itemsAgricoles", icon: Sprout },
  { key: "capteurs", labelKey: "tabs.capteurs", icon: Thermometer },
  { key: "registre", labelKey: "tabs.registre", icon: History },
  { key: "entretien", labelKey: "tabs.entretien", icon: Hammer },
] as const;

type TabKey = (typeof TABS)[number]["key"];

interface SalleTabsProps {
  children: React.ReactNode; // infos panel (server rendered)
  actifs: ActifLigne[];
  sensors?: SensorReading[];
  itemsAgricoles?: ItemAgricole[];
  achatUrl?: string;
  salleId: string;
  /** La salle a (ou a eu) un capteur rattaché : l'onglet Capteurs montre son passé. */
  aEuCapteur?: boolean;
  estAdmin?: boolean;
  salles?: SalleChoix[];
  tousActifs?: Actif[] | null;
  /** Gestionnaire ou administrateur : notes et justification des écarts (lot 5). */
  peutNoter?: boolean;
  /** Entretiens en retard et problèmes ouverts (pastille de l'onglet Entretien). */
  entretienASuivre?: number;
}

export function SalleTabs({
  children,
  actifs,
  sensors = [],
  itemsAgricoles = [],
  achatUrl = "https://demande-achat.chanv.com",
  salleId,
  aEuCapteur = false,
  estAdmin = false,
  salles = [],
  tousActifs = null,
  peutNoter = false,
  entretienASuivre = 0,
}: SalleTabsProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<TabKey>("infos");
  const [filtreActif, setFiltreActif] = useState<FiltreCible | null>(null);
  const [exporter, setExporter] = useState(false);
  const [aSuivre, setASuivre] = useState<number | null>(entretienASuivre);
  const haut = useRef<HTMLDivElement>(null);
  const noms = Object.fromEntries(salles.map((s) => [s.id, s.nomSalle]));

  // Lien direct vers un onglet (ex. …/salles/ZONE%20MULTI%205#registre).
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (TABS.some((x) => x.key === h)) setActiveTab(h as TabKey);
  }, []);

  const ouvrir = (k: TabKey) => {
    setActiveTab(k);
    haut.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Capteurs et items agricoles : seulement s'il y a quelque chose à montrer
  const visibleTabs = TABS.filter((x) => {
    if (x.key === "capteurs") return sensors.length > 0 || aEuCapteur;
    if (x.key === "items-agricoles") return itemsAgricoles.length > 0;
    return true;
  });

  return (
    <div className="space-y-6">
      <ResumeTerrain salleId={salleId} noms={noms} peutNoter={peutNoter} onVoirRegistre={() => ouvrir("registre")} />

      <div ref={haut} className="flex gap-1 overflow-x-auto pb-1 border-b border-chanv-fibre scroll-mt-4" role="tablist">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const count =
            tab.key === "actifs" ? actifs.length :
            tab.key === "items-agricoles" ? itemsAgricoles.length :
            tab.key === "capteurs" ? sensors.length :
            undefined;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl whitespace-nowrap transition-all ${
                isActive
                  ? "bg-chanv-fibre text-chanv-terre border-b-2 border-chanv-beige -mb-px"
                  : "text-slate-500 hover:text-chanv-terre hover:bg-chanv-fibre/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey)}
              {count !== undefined && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-chanv-terre/10 text-chanv-terre font-bold">
                  {count}
                </span>
              )}
              {tab.key === "entretien" && aSuivre ? (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-red-600 text-white font-bold">{aSuivre}</span>
              ) : null}
              {tab.key === "entretien" && (
                <span className="ml-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wide rounded-full bg-chanv-beige text-chanv-terre font-bold">
                  {t("tabs.nouveau")}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div>
        {activeTab === "infos" && children}
        {activeTab === "actifs" && (
          <ActifsSalle
            salleId={salleId}
            lignes={actifs}
            estAdmin={estAdmin}
            salles={salles}
            tousActifs={tousActifs}
            onHistorique={(a) => {
              setFiltreActif({ id: a.id, nom: a.nom || a.matricule || a.id });
              setActiveTab("registre");
            }}
          />
        )}
        {activeTab === "items-agricoles" && (
          <ItemsAgricolesTable
            items={itemsAgricoles}
            achatUrl={achatUrl}
            salleId={salleId}
            onHistorique={(it) => {
              setFiltreActif({ id: it.id, nom: it.name || it.sku || it.id, item: true });
              setActiveTab("registre");
            }}
          />
        )}
        {activeTab === "capteurs" && <CapteursTab salleId={salleId} />}
        {activeTab === "entretien" && <EntretienSalle salleId={salleId} onCompte={setASuivre} />}
        {activeTab === "registre" && (
          <RegistreTab
            salleId={salleId}
            noms={noms}
            filtreActif={filtreActif}
            onEffacerFiltre={() => setFiltreActif(null)}
            onExporter={() => setExporter(true)}
            peutNoter={peutNoter}
          />
        )}
      </div>

      {exporter && <ExportDialog salles={salles} salleId={salleId} onClose={() => setExporter(false)} />}
    </div>
  );
}
