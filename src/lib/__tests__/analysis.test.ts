import { describe, expect, it } from "vitest";
import {
  classifyJump,
  companyCostAt,
  detectCliffs,
  discountImpact,
  earningsCurve,
  incentiveAnalysis,
  referencePay,
  sensitivityTable,
  staffingTable,
} from "../analysis";
import { buildPresets, CURRENT_PLAN_ID } from "../presets";
import { defaultEmployees, defaultScenario } from "../defaults";

const presets = buildPresets();
const plan = (id: string) => presets.find((p) => p.id === id)!;
const current = plan(CURRENT_PLAN_ID);
const hybrid = plan("preset_tiered_hybrid");
const scenario = defaultScenario();

describe("cliff detector", () => {
  it("flags the current plan's $45k and $70k cliffs", () => {
    const cliffs = detectCliffs(current, scenario);
    const c45 = cliffs.find((c) => c.at === 45000)!;
    const c70 = cliffs.find((c) => c.at === 70000)!;
    expect(c45.before).toBe(44999);
    expect(c45.jump).toBeCloseTo(900, 2);
    expect(c45.size).toBe("Large");
    expect(c45.message).toContain("$900");
    expect(c70.jump).toBeCloseTo(700.02, 2);
  });
  it("tiered hybrid: $49,999 → $50,000 is about a $250 jump", () => {
    const c = detectCliffs(hybrid, scenario).find((x) => x.at === 50000)!;
    expect(c.jump).toBeCloseTo(250.015, 2);
    expect(c.size).toBe("Moderate");
  });
  it("finds store-revenue team thresholds", () => {
    const store = detectCliffs(hybrid, scenario, { headcount: 5 }).filter((c) => c.kind === "store");
    expect(store.map((c) => c.at)).toEqual([225000, 250000, 275000, 300000]);
    expect(store[0].jump).toBeCloseTo(100, 0);
  });
  it("marginal tiers produce no cliff", () => {
    const marginal = { ...hybrid, bonuses: [], team: { ...hybrid.team, enabled: false }, commission: { ...hybrid.commission, style: "marginal" as const } };
    const cliffs = detectCliffs(marginal, scenario);
    expect(cliffs.length).toBeGreaterThan(0);
    expect(cliffs.every((c) => c.size === "None")).toBe(true);
  });
  it("base only has no thresholds", () => {
    expect(detectCliffs(plan("preset_base_only"), scenario)).toHaveLength(0);
  });
  it("classifies sizes", () => {
    expect(classifyJump(2)).toBe("None");
    expect(classifyJump(100)).toBe("Small");
    expect(classifyJump(251)).toBe("Moderate");
    expect(classifyJump(900)).toBe("Large");
  });
});

describe("reference pay & curves", () => {
  it("reference pay matches the engine for the current plan", () => {
    expect(referencePay(current, scenario, 45000).total).toBeCloseTo(2595 + 900, 2);
    expect(referencePay(current, scenario, 44999).total).toBeCloseTo(2595, 2);
  });
  it("earnings curve includes both sides of each cliff", () => {
    const pts = earningsCurve(current, scenario);
    const at = (x: number) => pts.find((p) => p.x === x)!.y;
    expect(at(44999)).toBeCloseTo(2595, 2);
    expect(at(45000)).toBeCloseTo(3495, 2);
    expect(pts[0].x).toBe(0);
    expect(pts[pts.length - 1].x).toBe(120000);
  });
  it("company cost at equal split", () => {
    const r = companyCostAt(current, scenario, 225000, 5);
    // 5 x ($2,595 + 2% x $45,000)
    expect(r.totals.total).toBeCloseTo(5 * 3495, 2);
  });
});

describe("sensitivity & staffing", () => {
  it("sensitivity grid covers every revenue/margin pair", () => {
    const cells = sensitivityTable(current, scenario, defaultEmployees());
    expect(cells).toHaveLength(24);
    const c = cells.find((x) => x.revenue === 200000 && x.marginPct === 38)!;
    expect(c.gpAfterComp).toBeCloseTo(76000 - c.comp, 6);
  });
  it("staffing: $200k / 4 and even-distribution customer opportunities", () => {
    const rows = staffingTable(current, scenario, 200000);
    const four = rows.find((r) => r.salespeople === 4)!;
    expect(four.revenuePerPerson).toBe(50000);
    expect(four.opportunitiesPerPerson).toBeCloseTo((15 * 26) / 4, 6);
  });
});

describe("incentive analysis", () => {
  it("produces factual observations without ranking language", () => {
    const sections = incentiveAnalysis(hybrid, current, scenario, defaultEmployees());
    const text = sections.flatMap((s) => s.observations).join(" ").toLowerCase();
    expect(sections.length).toBeGreaterThanOrEqual(10);
    for (const banned of ["best plan", "bad plan", "winner", "recommended"]) expect(text).not.toContain(banned);
    expect(text).toContain("guaranteed base pay");
  });
  it("GP commission shows larger pay response to discounting than revenue commission", () => {
    const gp = discountImpact(plan("preset_gp_commission"), scenario, 50000, 10);
    const rev = discountImpact(plan("preset_performance_first"), scenario, 50000, 10);
    expect(gp.gpChangePct).toBeCloseTo((-5000 / 19000) * 100, 4);
    expect(Math.abs(gp.variableChangePct)).toBeGreaterThan(Math.abs(rev.variableChangePct));
  });
});
