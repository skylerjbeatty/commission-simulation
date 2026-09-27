"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  defaultState,
  loadSaved,
  loadWorking,
  normalizeState,
  persistSaved,
  saveWorking,
  snapshot,
  type AppState,
  type SavedScenario,
} from "@/lib/store";
import { uid } from "@/lib/presets";
import type { CompensationPlan } from "@/lib/types";

interface Ctx {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  planById: (id: string) => CompensationPlan;
  updatePlan: (id: string, fn: (p: CompensationPlan) => CompensationPlan) => void;
  saved: SavedScenario[];
  saveAs: (name: string) => void;
  saveActive: () => void;
  loadScenario: (id: string) => void;
  renameScenario: (id: string, name: string) => void;
  duplicateScenario: (id: string) => void;
  deleteScenario: (id: string) => void;
  resetAll: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // This component is only rendered client-side (see ClientApp), so reading storage here is safe.
  const [state, setState] = useState<AppState>(() => loadWorking());
  const [saved, setSaved] = useState<SavedScenario[]>(() => loadSaved());

  const update = useCallback((fn: (s: AppState) => AppState) => {
    setState((prev) => {
      const next = fn(prev);
      saveWorking(next);
      return next;
    });
  }, []);

  const setSavedPersist = useCallback((fn: (l: SavedScenario[]) => SavedScenario[]) => {
    setSaved((prev) => {
      const next = fn(prev);
      persistSaved(next);
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(() => {
    const planById = (id: string) => state.plans.find((p) => p.id === id) ?? state.plans[0];
    return {
      state,
      update,
      planById,
      updatePlan: (id, fn) =>
        update((s) => ({
          ...s,
          plans: s.plans.map((p) => (p.id === id && !p.locked ? fn(p) : p)),
        })),
      saved,
      saveAs: (name) => {
        const snap = snapshot(state, name);
        setSavedPersist((l) => [...l, snap]);
        update((s) => ({ ...s, activeScenarioId: snap.id, activeScenarioName: name }));
      },
      saveActive: () => {
        if (!state.activeScenarioId) return;
        const snap = snapshot(state, state.activeScenarioName, state.activeScenarioId);
        setSavedPersist((l) => l.map((x) => (x.id === snap.id ? snap : x)));
      },
      loadScenario: (id) => {
        const found = saved.find((x) => x.id === id);
        if (!found) return;
        update(() => normalizeState({ ...found.state, activeScenarioId: found.id, activeScenarioName: found.name, notes: found.notes }));
      },
      renameScenario: (id, name) => {
        setSavedPersist((l) => l.map((x) => (x.id === id ? { ...x, name, state: { ...x.state, activeScenarioName: name } } : x)));
        if (state.activeScenarioId === id) update((s) => ({ ...s, activeScenarioName: name }));
      },
      duplicateScenario: (id) => {
        const found = saved.find((x) => x.id === id);
        if (!found) return;
        const newId = uid("scn");
        const name = `${found.name} (copy)`;
        setSavedPersist((l) => [
          ...l,
          { ...JSON.parse(JSON.stringify(found)), id: newId, name, savedAt: new Date().toISOString(), state: { ...found.state, activeScenarioId: newId, activeScenarioName: name } },
        ]);
      },
      deleteScenario: (id) => {
        setSavedPersist((l) => l.filter((x) => x.id !== id));
        if (state.activeScenarioId === id) update((s) => ({ ...s, activeScenarioId: null, activeScenarioName: "Working scenario" }));
      },
      resetAll: () => update(() => defaultState()),
    };
  }, [state, saved, update, setSavedPersist]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
}
