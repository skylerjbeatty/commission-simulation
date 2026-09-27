"use client";

import { useState } from "react";
import { AppProvider } from "./AppContext";
import ScenarioPanel from "./ScenarioPanel";
import SimulatorTab from "./tabs/SimulatorTab";
import CompareTab from "./tabs/CompareTab";
import AnnualTab from "./tabs/AnnualTab";
import BuilderTab from "./tabs/BuilderTab";

const TABS = [
  { key: "simulator", label: "Simulator" },
  { key: "compare", label: "Compare Plans" },
  { key: "annual", label: "Annual Simulation" },
  { key: "builder", label: "Plan Builder" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function initialTab(): TabKey {
  const h = window.location.hash.replace("#", "");
  return (TABS.find((t) => t.key === h)?.key ?? "simulator") as TabKey;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const go = (t: TabKey) => {
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <AppProvider>
      <div className="min-h-screen">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="text-xs font-semibold tracking-widest text-stone-500 uppercase">Guion&apos;s Showcase Furniture &amp; Appliances</div>
              <h1 className="text-xl font-bold tracking-tight">Sales Compensation Simulator</h1>
            </div>
            <nav className="flex flex-wrap gap-1" aria-label="Main">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => go(t.key)}
                  className={`rounded-md px-3 py-2 text-sm font-semibold tracking-wide uppercase ${
                    tab === t.key ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-5">
          <ScenarioPanel />
          {tab === "simulator" && <SimulatorTab onEditPlan={() => go("builder")} />}
          {tab === "compare" && <CompareTab />}
          {tab === "annual" && <AnnualTab />}
          {tab === "builder" && <BuilderTab />}
        </main>
        <footer className="mx-auto max-w-[1400px] px-4 pb-8 text-xs text-stone-500">
          All calculations run locally in this browser. Scenarios are saved to this browser&apos;s local storage only. This tool
          describes tradeoffs; it does not rank plans.
        </footer>
      </div>
    </AppProvider>
  );
}
