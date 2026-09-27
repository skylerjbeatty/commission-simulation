import { calculatePlan } from "./engine";
import { storeDepartmentMix, withPersonalSales, type AnnualMonth } from "./defaults";
import type { CalculationResult, CompensationPlan, Employee, StoreScenario } from "./types";

export interface AnnualSummary {
  months: CalculationResult[];
  revenue: number;
  grossProfit: number;
  totalComp: number;
  avgMonthlyComp: number;
  commission: number;
  teamBonuses: number;
  performanceBonuses: number;
  basePay: number;
  byEmployee: { id: string; name: string; sales: number; comp: number }[];
}

export function monthEmployees(employees: Employee[], m: AnnualMonth): Employee[] {
  const mix = storeDepartmentMix(employees);
  return employees.map((e) => withPersonalSales({ ...e, useDepartmentTotal: true }, m.employeeSales[e.id] ?? 0, mix));
}

export function simulateYear(
  plan: CompensationPlan,
  scenario: StoreScenario,
  employees: Employee[],
  months: AnnualMonth[],
): AnnualSummary {
  const results = months.map((m) =>
    calculatePlan(
      plan,
      { ...scenario, storeRevenueMode: "manual", storeRevenue: m.storeRevenue, grossMarginPct: m.grossMarginPct },
      monthEmployees(employees, m),
    ),
  );
  const sum = (f: (r: CalculationResult) => number) => results.reduce((a, r) => a + f(r), 0);
  const totalComp = sum((r) => r.totals.total);
  return {
    months: results,
    revenue: sum((r) => r.storeRevenue),
    grossProfit: sum((r) => r.storeGP),
    totalComp,
    avgMonthlyComp: results.length ? totalComp / results.length : 0,
    commission: sum((r) => r.totals.personalCommission + r.totals.departmentCommission),
    teamBonuses: sum((r) => r.totals.teamBonus),
    performanceBonuses: sum((r) => r.totals.individualBonuses),
    basePay: sum((r) => r.totals.basePay),
    byEmployee: employees.map((e, i) => ({
      id: e.id,
      name: e.name,
      sales: results.reduce((a, r) => a + r.employees[i].personalSales, 0),
      comp: results.reduce((a, r) => a + r.employees[i].total, 0),
    })),
  };
}
