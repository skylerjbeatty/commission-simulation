// Pure state transitions used by the UI.
import { distributeRevenue, MAX_SALESPEOPLE, MIN_SALESPEOPLE, newEmployee, storeDepartmentMix, withPersonalSales } from "./defaults";
import { personalSales, storeRevenueOf } from "./engine";
import { uid } from "./presets";
import type { AppState } from "./store";
import type { Employee } from "./types";

export function currentStoreRevenue(s: AppState): number {
  return storeRevenueOf(s.scenario, s.employees);
}

/** Set store revenue and split it across salespeople using the chosen distribution. */
export function applyStoreRevenue(s: AppState, revenue: number): AppState {
  const employees = distributeRevenue(s.employees, revenue, s.distribution.mode, s.distribution);
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
  const employees = distributeRevenue(s.employees, revenue, "proportional");
  return { ...s, employees, scenario: { ...s.scenario, storeRevenue: revenue } };
}
