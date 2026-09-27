import { describe, expect, it } from "vitest";
import {
  calculatePlan,
  commissionOnAmount,
  hourlyRateFor,
  personalCommissionFor,
  personalGP,
  personalSales,
  teamPool,
} from "../engine";
import { buildPresets, CURRENT_PLAN_ID, duplicatePlan } from "../presets";
import { defaultEmployees, defaultScenario, distributeRevenue, newEmployee } from "../defaults";
import type { CompensationPlan, Employee } from "../types";

const presets = buildPresets();
const plan = (id: string) => presets.find((p) => p.id === id)!;
const current = plan(CURRENT_PLAN_ID);
const hybrid = plan("preset_tiered_hybrid");
const perf = plan("preset_performance_first");
const tenure = plan("preset_tenure");
const scenario = defaultScenario();

function emp(sales: number, overrides: Partial<Employee> = {}): Employee {
  return { ...newEmployee("e", "Test", 0, sales), ...overrides };
}

/** Commission only (no bonuses/team) for a personal-sales level. */
function commission(p: CompensationPlan, sales: number) {
  return personalCommissionFor(emp(sales), p, scenario, { storeRevenue: 0, storeGP: 0 });
}

const BOUNDARIES = [
  29999, 30000, 39999, 40000, 44999, 45000, 49999, 50000, 59999, 60000, 69999, 70000, 79999, 80000, 99999, 100000,
];

describe("commissionOnAmount", () => {
  const tiers = [
    { id: "a", threshold: 0, ratePct: 0 },
    { id: "b", threshold: 30000, ratePct: 1 },
    { id: "c", threshold: 40000, ratePct: 1.5 },
    { id: "d", threshold: 50000, ratePct: 2 },
  ];
  it("flat pays the rate on everything", () => {
    expect(commissionOnAmount(50000, "flat", 2, [])).toBe(1000);
  });
  it("retroactive applies the achieved rate to the whole amount", () => {
    expect(commissionOnAmount(50000, "retroactive", 0, tiers)).toBe(1000);
    expect(commissionOnAmount(49999, "retroactive", 0, tiers)).toBeCloseTo(749.985, 5);
  });
  it("marginal applies each rate only inside its bracket", () => {
    // 10k @1% + 10k @1.5% = 100 + 150
    expect(commissionOnAmount(50000, "marginal", 0, tiers)).toBeCloseTo(250, 6);
    expect(commissionOnAmount(35000, "marginal", 0, tiers)).toBeCloseTo(50, 6);
    expect(commissionOnAmount(60000, "marginal", 0, tiers)).toBeCloseTo(450, 6);
  });
  it("tier order does not matter", () => {
    expect(commissionOnAmount(45000, "retroactive", 0, [...tiers].reverse())).toBeCloseTo(675, 6);
  });
  it("zero or negative amounts pay nothing", () => {
    expect(commissionOnAmount(0, "flat", 5, [])).toBe(0);
    expect(commissionOnAmount(-100, "retroactive", 0, tiers)).toBe(0);
  });
});

describe("CURRENT GUION'S PLAN", () => {
  it("is locked", () => {
    expect(current.locked).toBe(true);
  });
  it("$44,999 → $0 commission", () => expect(commission(current, 44999)).toBe(0));
  it("$45,000 → $900", () => expect(commission(current, 45000)).toBe(900));
  it("$69,999 → approximately $1,400", () => expect(commission(current, 69999)).toBeCloseTo(1399.98, 2));
  it("$70,000 → $2,100", () => expect(commission(current, 70000)).toBe(2100));

  const expected: Record<number, number> = {
    29999: 0,
    30000: 0,
    39999: 0,
    40000: 0,
    44999: 0,
    45000: 900,
    49999: 999.98,
    50000: 1000,
    59999: 1199.98,
    60000: 1200,
    69999: 1399.98,
    70000: 2100,
    79999: 2399.97,
    80000: 2400,
    99999: 2999.97,
    100000: 3000,
  };
  it.each(BOUNDARIES)("boundary $%i", (s) => {
    expect(commission(current, s)).toBeCloseTo(expected[s], 2);
  });

  it("total pay = $15 x 173 hours + commission", () => {
    const r = calculatePlan(current, scenario, [emp(45000)]);
    expect(r.employees[0].basePay).toBe(2595);
    expect(r.employees[0].total).toBe(3495);
  });

  it("duplicating produces an unlocked copy and leaves the original unchanged", () => {
    const copy = duplicatePlan(current);
    copy.commission.tiers[0].ratePct = 9;
    expect(copy.locked).toBe(false);
    expect(copy.id).not.toBe(current.id);
    expect(current.commission.tiers[0].ratePct).toBe(2);
  });
});

describe("TIERED HYBRID", () => {
  const expected: Record<number, number> = {
    29999: 0,
    30000: 300,
    39999: 399.99,
    40000: 600,
    44999: 674.99,
    45000: 675,
    49999: 749.99,
    50000: 1000,
    59999: 1199.98,
    60000: 1500,
    69999: 1749.98,
    70000: 2100,
    79999: 2399.97,
    80000: 2400,
    99999: 2999.97,
    100000: 3000,
  };
  it.each(BOUNDARIES)("commission boundary $%i", (s) => {
    expect(commission(hybrid, s)).toBeCloseTo(expected[s], 1);
  });

  it("performance bonuses: +$500 at $80k and another +$500 at $100k", () => {
    const at = (s: number) => calculatePlan(hybrid, { ...scenario, storeRevenueMode: "manual", storeRevenue: 0 }, [emp(s)]).employees[0];
    expect(at(79999).individualBonuses).toBe(0);
    expect(at(80000).individualBonuses).toBe(500);
    expect(at(99999).individualBonuses).toBe(500);
    expect(at(100000).individualBonuses).toBe(1000);
  });

  it("team bonus per person at store thresholds", () => {
    const at = (rev: number) =>
      calculatePlan(hybrid, { ...scenario, storeRevenueMode: "manual", storeRevenue: rev }, [emp(40000), emp(40000)])
        .employees[0].teamBonus;
    expect(at(224999)).toBe(0);
    expect(at(225000)).toBe(100);
    expect(at(250000)).toBe(200);
    expect(at(275000)).toBe(300);
    expect(at(300000)).toBe(400);
    expect(at(350000)).toBe(400);
  });
});

describe("PERFORMANCE FIRST", () => {
  it.each([
    [79999, 2399.97],
    [80000, 2800],
    [99999, 3499.97],
    [100000, 4000],
  ])("$%i → %f", (s, c) => {
    expect(commission(perf, s)).toBeCloseTo(c, 2);
  });
});

describe("TENURE + COMMISSION", () => {
  it("$13 start, +$1 per completed year, capped at $18", () => {
    expect(hourlyRateFor(emp(0, { tenureYears: 0 }), tenure)).toBe(13);
    expect(hourlyRateFor(emp(0, { tenureYears: 2.9 }), tenure)).toBe(15);
    expect(hourlyRateFor(emp(0, { tenureYears: 5 }), tenure)).toBe(18);
    expect(hourlyRateFor(emp(0, { tenureYears: 12 }), tenure)).toBe(18);
  });
  it("hourly wage override wins", () => {
    expect(hourlyRateFor(emp(0, { tenureYears: 3, hourlyWageOverride: 20 }), tenure)).toBe(20);
  });
});

describe("personal sales and gross profit", () => {
  it("personal sales can follow department totals or be manual", () => {
    const e = emp(50000);
    expect(personalSales(e)).toBe(50000);
    expect(personalSales({ ...e, useDepartmentTotal: false, manualPersonalSales: 61000 })).toBe(61000);
  });
  it("blank department margins fall back to the storewide margin", () => {
    expect(personalGP(emp(50000), scenario)).toBeCloseTo(19000, 6);
  });
  it("department margins are used when entered", () => {
    const e = { ...emp(0), sales: { appliances: 10000, furniture: 10000, mattresses: 0, protection: 0, other: 0 } };
    const sc = { ...scenario, departmentMargins: { ...scenario.departmentMargins, appliances: 20, furniture: 50 } };
    expect(personalGP(e, sc)).toBeCloseTo(7000, 6);
  });
  it("GP commission pays on gross profit, not revenue", () => {
    const gpPlan = plan("preset_gp_commission");
    // $50k sales @ 38% = $19,000 GP -> 5% tier = $950
    expect(commission(gpPlan, 50000)).toBeCloseTo(950, 6);
  });
});

describe("team pools", () => {
  const teamFirst = plan("preset_team_first");
  const teamPoolPlan = plan("preset_team_pool");
  it("revenue-percent pool", () => {
    expect(teamPool(teamFirst, scenario, { storeRevenue: 200000, storeGP: 76000 }, 5)).toBeCloseTo(3000, 6);
  });
  it("revenue above break-even pool", () => {
    expect(teamPool(teamPoolPlan, scenario, { storeRevenue: 190000, storeGP: 0 }, 5)).toBe(0);
    expect(teamPool(teamPoolPlan, scenario, { storeRevenue: 250000, storeGP: 0 }, 5)).toBeCloseTo(5000, 6);
  });
  it("pool splits sum to the pool", () => {
    const emps = defaultEmployees();
    const r = calculatePlan(teamFirst, scenario, emps);
    const pool = (225000 * 1.5) / 100;
    expect(r.totals.teamBonus).toBeCloseTo(pool, 1);
    // Blended 80% equal / 20% by sales: top seller gets more than bottom seller
    expect(r.employees[0].teamBonus).toBeGreaterThan(r.employees[4].teamBonus);
  });
});

describe("calculatePlan company results", () => {
  it("store revenue sums employee sales and GP uses the store margin", () => {
    const r = calculatePlan(current, scenario, defaultEmployees());
    expect(r.storeRevenue).toBe(225000);
    expect(r.storeGP).toBeCloseTo(85500, 6);
    expect(r.totals.total).toBeCloseTo(
      r.totals.basePay + r.totals.personalCommission + r.totals.departmentCommission + r.totals.individualBonuses + r.totals.teamBonus,
      1,
    );
    expect(r.gpAfterComp).toBeCloseTo(r.storeGP - r.totals.total, 6);
  });
  it("base only plan pays no commission", () => {
    const r = calculatePlan(plan("preset_base_only"), scenario, defaultEmployees());
    expect(r.totals.total).toBe(r.totals.basePay);
    expect(r.employees[0].basePay).toBe(18 * 173);
  });
  it("choose your risk uses each employee's track", () => {
    const risk = plan("preset_choose_risk");
    const r = calculatePlan(risk, { ...scenario, storeRevenueMode: "manual", storeRevenue: 0 }, [
      emp(50000, { track: "stability" }),
      emp(50000, { track: "performance" }),
    ]);
    expect(r.employees[0].basePay).toBe(17 * 173);
    expect(r.employees[0].personalCommission).toBe(500);
    expect(r.employees[1].basePay).toBe(13 * 173);
    expect(r.employees[1].personalCommission).toBe(1250);
  });
  it("distributing revenue preserves the total", () => {
    const emps = distributeRevenue(defaultEmployees(), 300000, "topHeavy", { topHeavyIntensity: 25 });
    expect(emps.reduce((s, e) => s + personalSales(e), 0)).toBeCloseTo(300000, -1);
    expect(personalSales(emps[0])).toBeGreaterThan(personalSales(emps[4]));
  });
});
