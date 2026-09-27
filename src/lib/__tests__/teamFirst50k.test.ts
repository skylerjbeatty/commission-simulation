import { describe, expect, it } from "vitest";
import { calculatePlan, excessByDepartmentCommission } from "../engine";
import { detectCliffs } from "../analysis";
import { buildPresets, CURRENT_PLAN_ID, TEAM_FIRST_50K_ID } from "../presets";
import { defaultScenario, newEmployee, splitByMix } from "../defaults";
import { normalizeState, defaultState } from "../store";
import type { Employee } from "../types";

const presets = buildPresets();
const plan = presets.find((p) => p.id === TEAM_FIRST_50K_ID)!;
const current = presets.find((p) => p.id === CURRENT_PLAN_ID)!;
const scenario = defaultScenario();

/** 48% appliance / 52% furniture-mattress, no protection or other sales. */
const MIX = { appliances: 0.48, furniture: 0.36, mattresses: 0.16, protection: 0, other: 0 };
/** Full-time month used in the quick checks: 2,080 hours / 12. */
const FULL_TIME = 2080 / 12;

function person(id: string, sales: number, extra: Partial<Employee> = {}): Employee {
  return { ...newEmployee(id, id, 0, 0, FULL_TIME), sales: splitByMix(sales, MIX), manualPersonalSales: sales, ...extra };
}
const adam = (sales: number) => person("Adam", sales, { isManager: true });
const regularPayroll = (emps: Employee[]) =>
  calculatePlan(plan, scenario, emps).employees.filter((e) => !e.paidSeparately).reduce((a, e) => a + e.total, 0);

describe("TEAM FIRST, PERSONAL COMMISSION AFTER $50K — quick checks", () => {
  it("Adam $100k + two staff at $75k, $250k store, 1% pool → $10,460 regular staff payroll", () => {
    const emps = [adam(100000), person("A", 75000), person("B", 75000)];
    const r = calculatePlan(plan, scenario, emps);
    expect(r.storeRevenue).toBe(250000);
    expect(regularPayroll(emps)).toBeCloseTo(10460, 2);
    // Per person: $2,600 base + $1,250 team + $380 commission + $1,000 bonuses
    const a = r.employees[1];
    expect(a.basePay).toBeCloseTo(2600, 2);
    expect(a.teamBonus).toBeCloseTo(1250, 2);
    expect(a.personalCommission).toBeCloseTo(380, 2);
    expect(a.individualBonuses).toBe(1000);
  });

  it("Adam $80k + four staff at $42,500 → $12,900 regular staff payroll", () => {
    const emps = [adam(80000), person("A", 42500), person("B", 42500), person("C", 42500), person("D", 42500)];
    expect(calculatePlan(plan, scenario, emps).storeRevenue).toBe(250000);
    expect(regularPayroll(emps)).toBeCloseTo(12900, 2);
  });

  it("at 173 hours (the simulator's default full-time month) the same checks give $10,450 and $12,880", () => {
    const at173 = (e: Employee) => ({ ...e, hoursWorked: 173 });
    expect(regularPayroll([adam(100000), person("A", 75000), person("B", 75000)].map(at173))).toBeCloseTo(10450, 2);
    expect(
      regularPayroll([adam(80000), person("A", 42500), person("B", 42500), person("C", 42500), person("D", 42500)].map(at173)),
    ).toBeCloseTo(12880, 2);
  });
});

describe("manager treatment", () => {
  const emps = [adam(100000), person("A", 75000), person("B", 75000)];
  const r = calculatePlan(plan, scenario, emps);
  it("Adam is paid nothing by this plan and flagged as paid separately", () => {
    expect(r.employees[0].paidSeparately).toBe(true);
    expect(r.employees[0].total).toBe(0);
  });
  it("Adam's sales count toward the pool, but the pool is split only among regular staff", () => {
    expect(r.totals.teamBonus).toBeCloseTo(2500, 2);
    expect(r.headcount).toBe(2);
  });
  it("the pool is split in proportion to hours worked", () => {
    const res = calculatePlan(plan, scenario, [adam(100000), person("A", 75000, { hoursWorked: 120 }), person("B", 75000, { hoursWorked: 180 })]);
    expect(res.employees[1].teamBonus).toBeCloseTo(1000, 2);
    expect(res.employees[2].teamBonus).toBeCloseTo(1500, 2);
  });
  it("hourly pay uses actual hours worked", () => {
    const res = calculatePlan(plan, scenario, [adam(0), person("A", 0, { hoursWorked: 100 }), person("B", 0)]);
    expect(res.employees[1].basePay).toBe(1500);
  });
  it("existing plans still pay the manager", () => {
    const cur = calculatePlan(current, scenario, emps);
    expect(cur.employees[0].paidSeparately).toBeUndefined();
    expect(cur.employees[0].total).toBeGreaterThan(0);
  });
});

describe("$50,000 threshold behavior", () => {
  const pay = (sales: number) => calculatePlan(plan, scenario, [adam(0), person("A", sales)]).employees[1];
  it("$49,999: no bonus, no commission", () => {
    expect(pay(49999).individualBonuses).toBe(0);
    expect(pay(49999).personalCommission).toBe(0);
  });
  it("exactly $50,000: $500 bonus but no personal commission yet", () => {
    expect(pay(50000).individualBonuses).toBe(500);
    expect(pay(50000).personalCommission).toBe(0);
  });
  it("commission applies only to the portion above $50,000 (not retroactive)", () => {
    // $10,000 above the threshold: 48% x 1% + 52% x 2% = $152
    expect(pay(60000).personalCommission).toBeCloseTo(152, 6);
    const e = person("x", 50001);
    expect(excessByDepartmentCommission(e, plan.commission)).toBeCloseTo(0.0152, 6);
  });
  it("milestones stack to $1,500 at $100,000", () => {
    expect(pay(74999).individualBonuses).toBe(500);
    expect(pay(75000).individualBonuses).toBe(1000);
    expect(pay(99999).individualBonuses).toBe(1000);
    expect(pay(100000).individualBonuses).toBe(1500);
    expect(pay(150000).individualBonuses).toBe(1500);
  });
  it("protection and other sales earn no personal commission in this plan", () => {
    const e = { ...person("x", 0), sales: { appliances: 0, furniture: 0, mattresses: 0, protection: 60000, other: 10000 } };
    expect(excessByDepartmentCommission(e, plan.commission)).toBe(0);
  });
  it("cliff detector reports the $500 jump at $50k with no commission step", () => {
    const c = detectCliffs(plan, scenario, { hours: FULL_TIME }).find((x) => x.at === 50000)!;
    expect(c.jump).toBeCloseTo(500, 6);
  });
});

describe("saved-data migration", () => {
  it("adds the new preset to older saved data without changing existing plans", () => {
    const old = defaultState();
    old.plans = old.plans.filter((p) => p.id !== TEAM_FIRST_50K_ID);
    old.plans[1] = { ...old.plans[1], name: "My edited hybrid" };
    old.employees = old.employees.map((e) => {
      const copy = { ...e };
      delete copy.isManager;
      return copy;
    });
    const n = normalizeState(old);
    expect(n.plans.some((p) => p.id === TEAM_FIRST_50K_ID)).toBe(true);
    expect(n.plans[1].name).toBe("My edited hybrid");
    expect(n.employees.find((e) => e.name === "Adam")!.isManager).toBe(true);
    expect(n.employees.filter((e) => e.isManager)).toHaveLength(1);
  });
});

describe("plan rule text", () => {
  it("describes the threshold from current settings", async () => {
    const { describePlanRules } = await import("../planRules");
    const lines = describePlanRules(plan);
    expect(lines[0]).toBe(
      "At exactly $50,000 in personal sales, the salesperson earns the $500 milestone bonus but no personal commission yet. Personal commission starts with the next dollar sold.",
    );
    expect(lines.join(" ")).toContain("1% on appliances, 2% on furniture, 2% on mattresses");
    expect(lines.join(" ")).toContain("up to $1,500");
    const moved = describePlanRules({ ...plan, commission: { ...plan.commission, excessThreshold: 60000 } });
    expect(moved[0]).toContain("At exactly $60,000");
  });
});
