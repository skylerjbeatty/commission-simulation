import { describe, expect, it } from "vitest";
import { calculatePlan, excessCommissionDetail, regularStaffPayroll } from "../engine";
import { buildPresets, CURRENT_PLAN_ID, firstSaleVariant, INDIVIDUAL_GROWTH_ID, supportsFirstSaleVariant } from "../presets";
import { defaultScenario, distributeRevenue, newEmployee, splitByMix } from "../defaults";
import { defaultState } from "../store";
import { setTransactions } from "../actions";
import type { Employee, SaleTransaction } from "../types";

const presets = buildPresets();
const plan = presets.find((p) => p.id === INDIVIDUAL_GROWTH_ID)!;
const current = presets.find((p) => p.id === CURRENT_PLAN_ID)!;
const scenario = defaultScenario();
const MIX = { appliances: 0.48, furniture: 0.36, mattresses: 0.16, protection: 0, other: 0 };

function person(id: string, sales: number, extra: Partial<Employee> = {}): Employee {
  return { ...newEmployee(id, id, 0, 0, 173), sales: splitByMix(sales, MIX), manualPersonalSales: sales, ...extra };
}
const tx = (department: SaleTransaction["department"], amount: number, extra: Partial<SaleTransaction> = {}): SaleTransaction => ({
  id: `${department}${amount}${Math.random()}`,
  department,
  amount,
  delivered: true,
  returned: false,
  ...extra,
});

describe("TEAM FIRST, INDIVIDUAL GROWTH — check example", () => {
  // $250k store: Adam (manager) + four regular salespeople, equal hours.
  const emps = [
    person("Adam", 60000, { isManager: true }),
    person("A", 42500),
    person("B", 75000),
    person("C", 42500),
    person("D", 30000),
  ];
  const r = calculatePlan(plan, scenario, emps);
  it("store sales are $250k and the 1% pool gives each regular salesperson $625", () => {
    expect(r.storeRevenue).toBe(250000);
    for (const e of r.employees.slice(1)) expect(e.teamBonus).toBeCloseTo(625, 6);
    expect(r.employees[0].paidSeparately).toBe(true);
  });
  it("a person at $42,500 gets hourly pay plus $625 and nothing else", () => {
    const a = r.employees[1];
    expect(a.total).toBeCloseTo(15 * 173 + 625, 6);
    expect(a.personalCommission).toBe(0);
    expect(a.individualBonuses).toBe(0);
  });
  it("a person at $75,000 keeps the $625, gets $1,000 bonuses, and commission on only the $25,000 above $50k", () => {
    const b = r.employees[2];
    expect(b.teamBonus).toBeCloseTo(625, 6);
    expect(b.individualBonuses).toBe(1000);
    expect(b.personalCommission).toBeCloseTo(25000 * 0.48 * 0.01 + 25000 * 0.52 * 0.02, 6);
    expect(b.commissionIsEstimate).toBe(true);
  });
  it("current-plan comparison excludes Adam from both totals", () => {
    const cur = calculatePlan(current, scenario, emps);
    const regularCurrent = regularStaffPayroll(cur, emps);
    // Current: $42.5k and $30k earn 0; $42.5k 0; $75k -> 3% = $2,250
    expect(regularCurrent).toBeCloseTo(4 * 15 * 173 + 2250, 6);
    expect(regularStaffPayroll(r, emps)).toBeCloseTo(r.totals.total, 6);
  });
  it("team pool is labeled as paid quarterly", () => {
    expect(plan.team.payout).toBe("quarterly");
  });
});

describe("transactions", () => {
  const rule = plan.commission;
  it("department rates apply to the sales booked after crossing $50k", () => {
    const furnitureFirst = person("x", 0, { useTransactions: true, transactions: [tx("furniture", 45000), tx("appliances", 10000)] });
    const appliancesFirst = person("y", 0, { useTransactions: true, transactions: [tx("appliances", 10000), tx("furniture", 45000)] });
    // $5,000 above $50k: all appliances (1%) vs all furniture (2%)
    expect(excessCommissionDetail(furnitureFirst, rule).total).toBeCloseTo(50, 6);
    expect(excessCommissionDetail(appliancesFirst, rule).total).toBeCloseTo(100, 6);
    expect(excessCommissionDetail(furnitureFirst, rule).isEstimate).toBe(false);
  });
  it("a sale that crosses $50k is split at the threshold", () => {
    const e = person("x", 0, { useTransactions: true, transactions: [tx("appliances", 40000), tx("furniture", 20000)] });
    expect(excessCommissionDetail(e, rule).total).toBeCloseTo(200, 6); // $10k of the furniture sale is above $50k
  });
  it("without transactions the above-$50k mix is a proportional estimate", () => {
    const e = { ...person("x", 0), sales: { appliances: 10000, furniture: 45000, mattresses: 0, protection: 0, other: 0 } };
    const d = excessCommissionDetail(e, rule);
    expect(d.isEstimate).toBe(true);
    expect(d.total).toBeCloseTo(5000 * (10 / 55) * 0.01 + 5000 * (45 / 55) * 0.02, 6);
  });
  it("returns are removed from sales and reverse the related commission", () => {
    const e = person("x", 0, { useTransactions: true, transactions: [tx("furniture", 50000), tx("furniture", 10000, { returned: true }), tx("appliances", 5000)] });
    expect(excessCommissionDetail(e, rule).total).toBeCloseTo(50, 6);
    const s = setTransactions({ ...defaultState(), employees: [e] }, "x", e.transactions!, true);
    expect(s.employees[0].sales.furniture).toBe(50000);
    expect(s.employees[0].sales.appliances).toBe(5000);
  });
  it("commission on undelivered sales is earned but shown as pending delivery", () => {
    const e = person("x", 0, { useTransactions: true, transactions: [tx("furniture", 50000), tx("furniture", 10000, { delivered: false })] });
    const d = excessCommissionDetail(e, rule);
    expect(d.total).toBeCloseTo(200, 6);
    expect(d.pendingDelivery).toBeCloseTo(200, 6);
  });
  it("store revenue buttons keep transaction-entered sales fixed", () => {
    const locked = person("x", 0, { useTransactions: true, transactions: [tx("furniture", 60000)], sales: splitByMix(60000, { ...MIX, appliances: 0, furniture: 1, mattresses: 0 }) });
    const out = distributeRevenue([locked, person("y", 10000), person("z", 10000)], 200000, "equal", { lockTransactions: true });
    expect(out[0].sales.furniture).toBe(60000);
    expect(out[1].manualPersonalSales + out[2].manualPersonalSales).toBeCloseTo(140000, -1);
  });
});

describe("small personal commission from the first sale (variation)", () => {
  it("is available for threshold plans and leaves the main plan unchanged", () => {
    expect(supportsFirstSaleVariant(plan)).toBe(true);
    const v = firstSaleVariant(plan, 0.5);
    expect(v.id).not.toBe(plan.id);
    expect(plan.commission.baseRatePct).toBeUndefined();
  });
  it("pays the small rate on sales up to $50k, then department rates above", () => {
    const v = firstSaleVariant(plan, 0.5);
    const at = (s: number) => calculatePlan(v, scenario, [person("x", s)]).employees[0].personalCommission;
    expect(at(42500)).toBeCloseTo(212.5, 6);
    expect(at(50000)).toBeCloseTo(250, 6);
    expect(at(75000)).toBeCloseTo(250 + 380, 6);
  });
});
