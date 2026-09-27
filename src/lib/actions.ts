// Pure state transitions used by the UI.
import { distributeRevenue, MAX_SALESPEOPLE, MIN_SALESPEOPLE, newEmployee, splitByMix, storeDepartmentMix, withPersonalSales } from "./defaults";
import { departmentTotal, personalSales, salesFromTransactions, storeRevenueOf, usesTransactions } from "./engine";
import { uid } from "./presets";
import type { AppState } from "./store";
import type { Department, Employee, SaleTransaction } from "./types";

export function currentStoreRevenue(s: AppState): number {
  return storeRevenueOf(s.scenario, s.employees);
}

/** Set store revenue and split it across salespeople using the chosen distribution. */
export function applyStoreRevenue(s: AppState, revenue: number): AppState {
  const employees = distributeRevenue(s.employees, revenue, s.distribution.mode, { ...s.distribution, lockTransactions: true });
  return { ...s, employees, scenario: { ...s.scenario, storeRevenue: revenue } };
}

/** Re-split the current store revenue (used when the distribution settings change). */
export function redistribute(s: AppState): AppState {
  return applyStoreRevenue(s, currentStoreRevenue(s));
}

export function addEmployee(s: AppState, keepRevenue = s.keepRevenueOnHeadcountChange): AppState {
  if (s.employees.length >= MAX_SALESPEOPLE) return s;
  const revenue = currentStoreRevenue(s);
  const n = s.employees.length + 1;
  const avg = n > 1 ? s.employees.reduce((a, e) => a + personalSales(e), 0) / (n - 1) : 0;
  const e: Employee = withPersonalSales(
    newEmployee(uid("emp"), `Salesperson ${n}`, 0, 0, s.scenario.standardMonthlyHours),
    avg,
    storeDepartmentMix(s.employees),
  );
  let next: AppState = { ...s, employees: [...s.employees, e], annual: s.annual.map((m) => ({ ...m, employeeSales: { ...m.employeeSales, [e.id]: 0 } })) };
  if (keepRevenue) next = scaleToRevenue(next, revenue);
  return next;
}

export function removeEmployee(s: AppState, id: string, keepRevenue = s.keepRevenueOnHeadcountChange): AppState {
  if (s.employees.length <= MIN_SALESPEOPLE) return s;
  const revenue = currentStoreRevenue(s);
  let next: AppState = { ...s, employees: s.employees.filter((e) => e.id !== id) };
  if (keepRevenue) next = scaleToRevenue(next, revenue);
  return next;
}

export function setHeadcount(s: AppState, n: number): AppState {
  let next = s;
  while (next.employees.length < n && next.employees.length < MAX_SALESPEOPLE) next = addEmployee(next);
  while (next.employees.length > n && next.employees.length > MIN_SALESPEOPLE)
    next = removeEmployee(next, next.employees[next.employees.length - 1].id);
  return next;
}

/** Scale everyone's sales proportionally so the total matches `revenue`. */
export function scaleToRevenue(s: AppState, revenue: number): AppState {
  const employees = distributeRevenue(s.employees, revenue, "proportional", { lockTransactions: true });
  return { ...s, employees, scenario: { ...s.scenario, storeRevenue: revenue } };
}

/** Re-split every salesperson's personal sales using one department mix (fractions summing to 1). */
export function applySalesMix(s: AppState, mix: Record<Department, number>): AppState {
  // People with entered transactions keep their actual department split.
  return {
    ...s,
    employees: s.employees.map((e) => (usesTransactions(e) ? e : { ...e, sales: splitByMix(personalSales(e), mix) })),
  };
}

/** Replace a salesperson's transactions and keep their department totals in sync. */
export function setTransactions(s: AppState, id: string, transactions: SaleTransaction[], useTransactions?: boolean): AppState {
  return {
    ...s,
    employees: s.employees.map((e) => {
      if (e.id !== id) return e;
      const on = useTransactions ?? !!e.useTransactions;
      if (!on) return { ...e, transactions, useTransactions: false };
      const sales = salesFromTransactions(transactions);
      return { ...e, transactions, useTransactions: true, sales, useDepartmentTotal: true, manualPersonalSales: departmentTotal(sales) };
    }),
  };
}

/**
 * Build a mix from an appliance share, keeping protection/other shares and the current
 * furniture-to-mattress ratio. All values are fractions of total sales.
 */
export function mixWithApplianceShare(
  current: Record<Department, number>,
  appliances: number,
  protection = current.protection,
  other = current.other,
): Record<Department, number> {
  const p = Math.min(1, Math.max(0, protection));
  const o = Math.min(1 - p, Math.max(0, other));
  const a = Math.min(1 - p - o, Math.max(0, appliances));
  const fm = 1 - a - p - o;
  const fmNow = current.furniture + current.mattresses;
  const furnShare = fmNow > 0 ? current.furniture / fmNow : 0.7;
  return { appliances: a, furniture: fm * furnShare, mattresses: fm * (1 - furnShare), protection: p, other: o };
}
