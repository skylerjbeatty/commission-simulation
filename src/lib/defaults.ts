import { DEPARTMENTS, type Department, type DepartmentSales, type Employee, type StoreScenario } from "./types";
import { departmentTotal, personalSales } from "./engine";

export const DEPARTMENT_LABELS: Record<Department, string> = {
  appliances: "Appliances",
  furniture: "Furniture",
  mattresses: "Mattresses",
  protection: "Protection / Accessories",
  other: "Other",
};

export const DEPARTMENT_SHORT: Record<Department, string> = {
  appliances: "Appliance",
  furniture: "Furniture",
  mattresses: "Mattress",
  protection: "Protection",
  other: "Other",
};

/**
 * SAMPLE department mix used only to split sample/scenario sales across departments.
 * It is not a Guion's figure - edit department sales directly for real numbers.
 */
export const SAMPLE_DEPARTMENT_MIX: Record<Department, number> = {
  appliances: 0.4,
  furniture: 0.35,
  mattresses: 0.15,
  protection: 0.05,
  other: 0.05,
};

export const MIN_SALESPEOPLE = 3;
export const MAX_SALESPEOPLE = 8;

export function defaultScenario(): StoreScenario {
  return {
    storeName: "Guion's Showcase Furniture & Appliances",
    storeRevenueMode: "employees",
    storeRevenue: 225000,
    grossMarginPct: 38,
    estimatedBreakEvenRevenue: 200000,
    customersPerDay: 15,
    openDaysPerMonth: 26,
    standardMonthlyHours: 173,
    departmentMargins: { appliances: null, furniture: null, mattresses: null, protection: null, other: null },
  };
}

export function splitByMix(total: number, mix: Record<Department, number>): DepartmentSales {
  const sum = DEPARTMENTS.reduce((s, d) => s + (mix[d] || 0), 0) || 1;
  const out = {} as DepartmentSales;
  let assigned = 0;
  DEPARTMENTS.forEach((d, i) => {
    if (i === DEPARTMENTS.length - 1) out[d] = Math.round(total - assigned);
    else {
      out[d] = Math.round((total * (mix[d] || 0)) / sum);
      assigned += out[d];
    }
  });
  return out;
}

export function newEmployee(id: string, name: string, tenureYears: number, sales: number, hours = 173): Employee {
  return {
    id,
    name,
    tenureYears,
    hourlyWageOverride: null,
    hoursWorked: hours,
    sales: splitByMix(sales, SAMPLE_DEPARTMENT_MIX),
    useDepartmentTotal: true,
    manualPersonalSales: sales,
    track: "stability",
    teamWeight: 1,
  };
}

/** Sample team. Sales total $225,000; tenure values are placeholders to edit. Adam is the sales manager. */
export function defaultEmployees(): Employee[] {
  return [
    { ...newEmployee("emp_adam", "Adam", 8, 55000), isManager: true },
    newEmployee("emp_john", "John", 5, 50000),
    newEmployee("emp_chaneice", "Chaneice", 3, 45000),
    newEmployee("emp_kristene", "Kristene", 2, 40000),
    newEmployee("emp_terry", "Terry", 1, 35000),
  ];
}

/** Store-wide department mix from current employee data (falls back to the sample mix). */
export function storeDepartmentMix(employees: Employee[]): Record<Department, number> {
  const totals = {} as Record<Department, number>;
  let all = 0;
  for (const d of DEPARTMENTS) {
    totals[d] = employees.reduce((s, e) => s + (e.sales[d] || 0), 0);
    all += totals[d];
  }
  if (all <= 0) return { ...SAMPLE_DEPARTMENT_MIX };
  return Object.fromEntries(DEPARTMENTS.map((d) => [d, totals[d] / all])) as Record<Department, number>;
}

/** Set an employee's personal sales, keeping their own department mix when they have one. */
export function withPersonalSales(emp: Employee, total: number, fallbackMix: Record<Department, number>): Employee {
  const own = departmentTotal(emp.sales);
  const mix = own > 0 ? (Object.fromEntries(DEPARTMENTS.map((d) => [d, emp.sales[d] / own])) as Record<Department, number>) : fallbackMix;
  return { ...emp, sales: splitByMix(total, mix), manualPersonalSales: Math.round(total) };
}

export type DistributionMode = "equal" | "topHeavy" | "custom" | "proportional";

/**
 * Weights for splitting store revenue across salespeople.
 * topHeavy: the first person in the list gets the most; each next person gets (1 - intensity) of the previous.
 */
export function distributionWeights(
  employees: Employee[],
  mode: DistributionMode,
  opts: { topHeavyIntensity?: number; customShares?: Record<string, number> } = {},
): number[] {
  const n = employees.length;
  if (n === 0) return [];
  let raw: number[];
  switch (mode) {
    case "equal":
      raw = employees.map(() => 1);
      break;
    case "topHeavy": {
      const k = Math.min(0.9, Math.max(0, (opts.topHeavyIntensity ?? 20) / 100));
      raw = employees.map((_, i) => Math.pow(1 - k, i));
      break;
    }
    case "custom":
      raw = employees.map((e) => Math.max(0, opts.customShares?.[e.id] ?? 100 / n));
      break;
    case "proportional":
      raw = employees.map(personalSales);
      break;
  }
  const sum = raw.reduce((s, x) => s + x, 0);
  return sum > 0 ? raw.map((x) => x / sum) : employees.map(() => 1 / n);
}

export function distributeRevenue(
  employees: Employee[],
  total: number,
  mode: DistributionMode,
  opts: { topHeavyIntensity?: number; customShares?: Record<string, number> } = {},
): Employee[] {
  const weights = distributionWeights(employees, mode, opts);
  const mix = storeDepartmentMix(employees);
  return employees.map((e, i) => withPersonalSales(e, total * weights[i], mix));
}

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface AnnualMonth {
  month: string;
  storeRevenue: number;
  grossMarginPct: number;
  /** Personal sales by employee id. */
  employeeSales: Record<string, number>;
}

/** Twelve identical months based on the current scenario - edit each month for seasonality. */
export function defaultAnnual(employees: Employee[], grossMarginPct: number): AnnualMonth[] {
  const sales = Object.fromEntries(employees.map((e) => [e.id, personalSales(e)]));
  const revenue = Object.values(sales).reduce((s, x) => s + x, 0);
  return MONTHS.map((month) => ({ month, storeRevenue: revenue, grossMarginPct, employeeSales: { ...sales } }));
}

export interface RevenueScenarioPreset {
  key: string;
  label: string;
  revenue: number;
}

export function defaultRevenuePresets(): RevenueScenarioPreset[] {
  return [
    { key: "slow", label: "Slow Month", revenue: 175000 },
    { key: "breakeven", label: "Break-Even Estimate", revenue: 200000 },
    { key: "normal", label: "Normal Month", revenue: 225000 },
    { key: "strong", label: "Strong Month", revenue: 250000 },
    { key: "verystrong", label: "Very Strong", revenue: 275000 },
    { key: "exceptional", label: "Exceptional", revenue: 300000 },
  ];
}
