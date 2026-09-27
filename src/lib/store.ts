// App state shape + localStorage persistence. All storage access is wrapped so the app
// still works when storage is unavailable (private windows, blocked site data).
import {
  defaultAnnual,
  defaultEmployees,
  defaultRevenuePresets,
  defaultScenario,
  type AnnualMonth,
  type DistributionMode,
  type RevenueScenarioPreset,
} from "./defaults";
import { buildPresets, CURRENT_PLAN_ID, uid } from "./presets";
import type { CompensationPlan, Employee, StoreScenario } from "./types";

export interface AppState {
  version: 1;
  scenario: StoreScenario;
  employees: Employee[];
  plans: CompensationPlan[];
  selectedPlanId: string;
  comparePlanIds: string[];
  annual: AnnualMonth[];
  annualPlanId: string;
  revenuePresets: RevenueScenarioPreset[];
  distribution: {
    mode: DistributionMode;
    topHeavyIntensity: number;
    customShares: Record<string, number>;
  };
  /** Tenure used for the hypothetical salesperson in curves and analysis. */
  referenceTenure: number;
  keepRevenueOnHeadcountChange: boolean;
  notes: string;
  activeScenarioId: string | null;
  activeScenarioName: string;
}

export interface SavedScenario {
  id: string;
  name: string;
  notes: string;
  savedAt: string;
  state: AppState;
}

const WORKING_KEY = "guions-sim:working:v1";
const SAVED_KEY = "guions-sim:saved:v1";

export function defaultState(): AppState {
  const scenario = defaultScenario();
  const employees = defaultEmployees();
  return {
    version: 1,
    scenario,
    employees,
    plans: buildPresets(),
    selectedPlanId: "preset_tiered_hybrid",
    comparePlanIds: ["preset_tiered_hybrid", "preset_team_first", "preset_performance_first"],
    annual: defaultAnnual(employees, scenario.grossMarginPct),
    annualPlanId: "preset_tiered_hybrid",
    revenuePresets: defaultRevenuePresets(),
    distribution: { mode: "proportional", topHeavyIntensity: 15, customShares: {} },
    referenceTenure: 3,
    keepRevenueOnHeadcountChange: true,
    notes: "",
    activeScenarioId: null,
    activeScenarioName: "Working scenario",
  };
}

/** The current plan is always rebuilt from code so it can never be edited or corrupted. */
export function normalizeState(s: AppState): AppState {
  const fresh = buildPresets();
  const current = fresh.find((p) => p.id === CURRENT_PLAN_ID)!;
  let plans = s.plans?.length ? s.plans.filter((p) => p.id !== CURRENT_PLAN_ID) : fresh.slice(1);
  // Add any built-in preset introduced since this state was saved, without touching existing plans.
  const have = new Set(plans.map((p) => p.id));
  const added = fresh.slice(1).filter((p) => !have.has(p.id));
  plans = [current, ...plans, ...added];
  const ids = new Set(plans.map((p) => p.id));
  const fallback = plans[1]?.id ?? CURRENT_PLAN_ID;
  const base = defaultState();
  // Older saved data predates the manager flag: mark Adam as the sales manager once.
  let employees = s.employees ?? base.employees;
  if (!employees.some((e) => e.isManager !== undefined)) {
    employees = employees.map((e) => ({ ...e, isManager: e.id === "emp_adam" || e.name.trim().toLowerCase() === "adam" }));
  }
  return {
    ...base,
    ...s,
    employees,
    plans,
    selectedPlanId: ids.has(s.selectedPlanId) ? s.selectedPlanId : fallback,
    annualPlanId: ids.has(s.annualPlanId) ? s.annualPlanId : fallback,
    comparePlanIds: (s.comparePlanIds ?? []).filter((id) => ids.has(id)),
  };
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable - the app keeps working in memory.
  }
}

export function loadWorking(): AppState {
  const s = read<AppState>(WORKING_KEY);
  return s && s.version === 1 ? normalizeState(s) : defaultState();
}

export function saveWorking(s: AppState) {
  write(WORKING_KEY, s);
}

export function loadSaved(): SavedScenario[] {
  return read<SavedScenario[]>(SAVED_KEY) ?? [];
}

export function persistSaved(list: SavedScenario[]) {
  write(SAVED_KEY, list);
}

export function snapshot(state: AppState, name: string, id = uid("scn")): SavedScenario {
  const copy: AppState = JSON.parse(JSON.stringify(state));
  copy.activeScenarioId = id;
  copy.activeScenarioName = name;
  return { id, name, notes: state.notes, savedAt: new Date().toISOString(), state: copy };
}
