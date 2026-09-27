// Deterministic analysis built on the engine: reference-salesperson pay, curves, cliffs,
// sensitivity, staffing, and factual incentive observations. No AI, no opinions.
import {
  bonusAmount,
  calculatePlan,
  commissionOnAmount,
  individualPay,
  isStoreBonus,
  personalGP,
  resolveMargin,
  sortTiers,
  storeGPOf,
  teamPool,
  teamWeights,
  type StoreContext,
} from "./engine";
import { distributeRevenue, newEmployee, splitByMix, storeDepartmentMix } from "./defaults";
import {
  DEPARTMENTS,
  type CalculationResult,
  type CompensationPlan,
  type Department,
  type Employee,
  type StoreScenario,
  type Track,
} from "./types";
import { money, pct } from "./format";

export interface ReferenceOptions {
  tenureYears?: number;
  hours?: number;
  track?: Track;
  /** Store revenue used for team/store components. Defaults to the scenario's store revenue. */
  storeRevenue?: number;
  /** Headcount used to size a per-person share of the team pool. */
  headcount?: number;
  /** Managers included in headcount; excluded from the team split for plans that pay managers separately. */
  managerCount?: number;
  mix?: Record<Department, number>;
  /** Scenario override (e.g. discounted margins). */
  scenario?: StoreScenario;
}

export interface ReferencePay {
  sales: number;
  basePay: number;
  commission: number;
  departmentCommission: number;
  individualBonuses: number;
  teamBonus: number;
  total: number;
  variable: number;
  guaranteedPct: number;
}

/**
 * Monthly pay for a hypothetical salesperson at a given personal sales level.
 * Team pool share is the equal (per-person) share at the given store revenue and headcount.
 */
export function referencePay(
  plan: CompensationPlan,
  scenario: StoreScenario,
  sales: number,
  opts: ReferenceOptions = {},
): ReferencePay {
  const sc = opts.scenario ?? scenario;
  const mix = opts.mix ?? storeDepartmentMix([]);
  const emp: Employee = {
    ...newEmployee("ref", "Reference", opts.tenureYears ?? 0, 0, opts.hours ?? sc.standardMonthlyHours),
    sales: splitByMix(sales, mix),
    manualPersonalSales: sales,
    track: opts.track ?? "stability",
  };
  // splitByMix rounds to whole dollars; keep the exact total so thresholds are tested at the exact dollar.
  const diff = sales - DEPARTMENTS.reduce((s, d) => s + emp.sales[d], 0);
  const lastWithSales = [...DEPARTMENTS].reverse().find((d) => (mix[d] || 0) > 0) ?? "other";
  emp.sales[lastWithSales] += diff;

  const storeRevenue = opts.storeRevenue ?? scenario.storeRevenue;
  const ctx: StoreContext = { storeRevenue, storeGP: storeGPOf(storeRevenue, sc) };
  const headcount = Math.max(1, (opts.headcount ?? 5) - (plan.managersPaidSeparately ? (opts.managerCount ?? 0) : 0));
  const ind = individualPay(emp, plan, sc, ctx);
  const team = teamPool(plan, sc, ctx, headcount) / headcount + ind.storeBonuses;
  const total = ind.basePay + ind.personalCommission + ind.departmentCommission + ind.individualBonuses + team;
  return {
    sales,
    basePay: ind.basePay,
    commission: ind.personalCommission,
    departmentCommission: ind.departmentCommission,
    individualBonuses: ind.individualBonuses,
    teamBonus: team,
    total,
    variable: total - ind.basePay,
    guaranteedPct: total > 0 ? (ind.basePay / total) * 100 : 0,
  };
}

export function tracksFor(plan: CompensationPlan): Track[] {
  return plan.tracks.enabled ? ["stability", "performance"] : ["stability"];
}

export interface CurvePoint {
  x: number;
  y: number;
}

export function earningsCurve(
  plan: CompensationPlan,
  scenario: StoreScenario,
  opts: ReferenceOptions = {},
  maxSales = 120000,
  step = 500,
): CurvePoint[] {
  const xs = new Set<number>();
  for (let x = 0; x <= maxSales; x += step) xs.add(x);
  // Add the dollar just below every personal threshold so vertical jumps are drawn exactly.
  for (const c of personalThresholds(plan, scenario, opts)) {
    if (c.sales > 0 && c.sales <= maxSales) {
      xs.add(c.sales - 1);
      xs.add(c.sales);
    }
  }
  return [...xs]
    .sort((a, b) => a - b)
    .map((x) => ({ x, y: referencePay(plan, scenario, x, opts).total }));
}

/** Total sales compensation when store revenue is split equally across N salespeople. */
export function companyCostAt(
  plan: CompensationPlan,
  scenario: StoreScenario,
  revenue: number,
  headcount: number,
  opts: { tenureYears?: number; mix?: Record<Department, number>; grossMarginPct?: number } = {},
): CalculationResult {
  const mix = opts.mix ?? storeDepartmentMix([]);
  const each = revenue / headcount;
  const employees: Employee[] = Array.from({ length: headcount }, (_, i) => ({
    ...newEmployee(`h${i}`, `Salesperson ${i + 1}`, opts.tenureYears ?? 0, 0, scenario.standardMonthlyHours),
    sales: splitByMix(each, mix),
    manualPersonalSales: each,
    track: (i % 2 === 0 ? "stability" : "performance") as Track,
  }));
  return calculatePlan(
    plan,
    {
      ...scenario,
      storeRevenueMode: "manual",
      storeRevenue: revenue,
      grossMarginPct: opts.grossMarginPct ?? scenario.grossMarginPct,
    },
    employees,
  );
}

export function companyCostCurve(
  plan: CompensationPlan,
  scenario: StoreScenario,
  headcount: number,
  opts: { tenureYears?: number; mix?: Record<Department, number> } = {},
  min = 150000,
  max = 350000,
  step = 2500,
): CurvePoint[] {
  const pts: CurvePoint[] = [];
  const xs = new Set<number>();
  for (let x = min; x <= max; x += step) xs.add(x);
  for (const c of storeThresholds(plan)) {
    if (c > min && c <= max) {
      xs.add(c - 1);
      xs.add(c);
    }
  }
  // Personal thresholds matter too: with equal splits, personal sales = revenue / N.
  for (const c of personalThresholds(plan, scenario, { mix: opts.mix })) {
    const r = c.sales * headcount;
    if (r > min && r <= max) {
      xs.add(r - headcount);
      xs.add(r);
    }
  }
  for (const x of [...xs].sort((a, b) => a - b)) {
    pts.push({ x, y: companyCostAt(plan, scenario, x, headcount, opts).totals.total });
  }
  return pts;
}

// ---------------------------------------------------------------- Cliffs

export type CliffSize = "None" | "Small" | "Moderate" | "Large";

export function classifyJump(jump: number): CliffSize {
  const a = Math.abs(jump);
  if (a < 5) return "None";
  if (a < 150) return "Small";
  if (a < 500) return "Moderate";
  return "Large";
}

interface PersonalThreshold {
  sales: number;
  source: string;
  track?: Track;
}

function salesForAmount(amount: number, fraction: number): number {
  if (fraction <= 0) return NaN;
  return Math.ceil(Math.round((amount / fraction) * 1e6) / 1e6);
}

/** Personal sales levels (in dollars of personal sales) where a personal component changes. */
export function personalThresholds(
  plan: CompensationPlan,
  scenario: StoreScenario,
  opts: ReferenceOptions = {},
): PersonalThreshold[] {
  const mix = opts.mix ?? storeDepartmentMix([]);
  const blended = DEPARTMENTS.reduce((s, d) => s + (mix[d] || 0) * (resolveMargin(scenario, d) / 100), 0);
  const out: PersonalThreshold[] = [];

  for (const track of tracksFor(plan)) {
    const rule = plan.tracks.enabled ? plan.tracks[track].commission : plan.commission;
    const trackLabel = plan.tracks.enabled ? `${plan.tracks[track].label}: ` : "";
    if (rule.enabled && rule.basis === "personalExcessByDepartment" && (rule.excessThreshold ?? 0) > 0) {
      out.push({ sales: rule.excessThreshold!, source: `${trackLabel}Personal commission starts above ${money(rule.excessThreshold!)}`, track });
    }
    if (rule.enabled && rule.style !== "flat" && rule.basis !== "personalExcessByDepartment") {
      for (const t of sortTiers(rule.tiers)) {
        if (t.threshold <= 0) continue;
        const label = `${trackLabel}${pct(t.ratePct)} commission tier`;
        if (rule.basis === "personalRevenue") out.push({ sales: t.threshold, source: label, track });
        if (rule.basis === "personalGP")
          out.push({ sales: salesForAmount(t.threshold, blended), source: `${label} (${money(t.threshold)} GP)`, track });
        if (rule.basis === "departmentRevenue" || rule.basis === "departmentGP") {
          for (const d of DEPARTMENTS) {
            const f = (mix[d] || 0) * (rule.basis === "departmentGP" ? resolveMargin(scenario, d) / 100 : 1);
            const s = salesForAmount(t.threshold, f);
            if (Number.isFinite(s)) out.push({ sales: s, source: `${label} (${d})`, track });
          }
        }
      }
    }
  }

  if (plan.departmentCommission.enabled) {
    for (const d of DEPARTMENTS) {
      const r = plan.departmentCommission.rules[d];
      if (r.style === "flat") continue;
      const f = (mix[d] || 0) * (r.method === "grossProfit" ? resolveMargin(scenario, d) / 100 : 1);
      for (const t of sortTiers(r.tiers)) {
        if (t.threshold <= 0) continue;
        const s = salesForAmount(t.threshold, f);
        if (Number.isFinite(s)) out.push({ sales: s, source: `${d} department ${pct(t.ratePct)} tier` });
      }
    }
  }

  for (const b of plan.bonuses) {
    if (isStoreBonus(b) || b.threshold <= 0) continue;
    const label = `Bonus: ${b.label || money(b.threshold)}`;
    if (b.trigger === "personalSales") out.push({ sales: b.threshold, source: label });
    if (b.trigger === "personalGP") out.push({ sales: salesForAmount(b.threshold, blended), source: label });
    if ((b.trigger === "departmentSales" || b.trigger === "departmentGP") && b.department) {
      const d = b.department;
      const f = (mix[d] || 0) * (b.trigger === "departmentGP" ? resolveMargin(scenario, d) / 100 : 1);
      const s = salesForAmount(b.threshold, f);
      if (Number.isFinite(s)) out.push({ sales: s, source: label });
    }
  }
  return out.filter((t) => Number.isFinite(t.sales) && t.sales > 0);
}

/** Store revenue levels where a store-linked component changes. */
export function storeThresholds(plan: CompensationPlan): number[] {
  const out = new Set<number>();
  if (plan.team.enabled && plan.team.poolType === "fixedThreshold") {
    for (const t of plan.team.thresholds) if (t.threshold > 0) out.add(t.threshold);
  }
  for (const b of plan.bonuses) if (b.trigger === "storeSales" && b.threshold > 0) out.add(b.threshold);
  for (const track of tracksFor(plan)) {
    const rule = plan.tracks.enabled ? plan.tracks[track].commission : plan.commission;
    if (rule.enabled && rule.basis === "storeRevenue" && rule.style !== "flat")
      for (const t of rule.tiers) if (t.threshold > 0) out.add(t.threshold);
  }
  return [...out].sort((a, b) => a - b);
}

export interface Cliff {
  kind: "personal" | "store";
  source: string;
  threshold: number;
  before: number;
  at: number;
  payBefore: number;
  payAt: number;
  jump: number;
  /** Company-wide change (store thresholds only). */
  companyJump?: number;
  size: CliffSize;
  message: string;
}

export function detectCliffs(
  plan: CompensationPlan,
  scenario: StoreScenario,
  opts: ReferenceOptions = {},
): Cliff[] {
  const cliffs: Cliff[] = [];
  const seen = new Set<string>();
  for (const t of personalThresholds(plan, scenario, opts)) {
    const key = `${t.track ?? ""}:${t.sales}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const o = { ...opts, track: t.track ?? opts.track };
    const payBefore = referencePay(plan, scenario, t.sales - 1, o).total;
    const payAt = referencePay(plan, scenario, t.sales, o).total;
    const jump = payAt - payBefore;
    const size = classifyJump(jump);
    cliffs.push({
      kind: "personal",
      source: t.source,
      threshold: t.sales,
      before: t.sales - 1,
      at: t.sales,
      payBefore,
      payAt,
      jump,
      size,
      message:
        size === "None"
          ? `Crossing ${money(t.sales)} in personal sales changes monthly pay by less than $5 - no cliff at this threshold.`
          : `Crossing this $1 sales threshold (${money(t.sales - 1)} → ${money(t.sales)}) ${jump >= 0 ? "increases" : "decreases"} monthly compensation by approximately ${money(Math.abs(jump))}.`,
    });
  }

  const headcount = Math.max(1, opts.headcount ?? 5);
  for (const r of storeThresholds(plan)) {
    const before = companyCostAt(plan, scenario, r - 1, headcount, { tenureYears: opts.tenureYears, mix: opts.mix });
    const at = companyCostAt(plan, scenario, r, headcount, { tenureYears: opts.tenureYears, mix: opts.mix });
    const companyJump = at.totals.total - before.totals.total;
    const jump = companyJump / headcount;
    const size = classifyJump(jump);
    cliffs.push({
      kind: "store",
      source: "Store revenue threshold",
      threshold: r,
      before: r - 1,
      at: r,
      payBefore: before.avgCompPerSalesperson,
      payAt: at.avgCompPerSalesperson,
      jump,
      companyJump,
      size,
      message: `Store revenue moving from ${money(r - 1)} to ${money(r)} changes pay by about ${money(jump)} per salesperson (${money(companyJump)} company-wide with ${headcount} salespeople).`,
    });
  }
  return cliffs.sort((a, b) => a.kind.localeCompare(b.kind) || a.threshold - b.threshold);
}

// ---------------------------------------------------------------- Sensitivity & staffing

export const SENSITIVITY_REVENUES = [175000, 200000, 225000, 250000, 275000, 300000];
export const SENSITIVITY_MARGINS = [35, 38, 40, 42];

export interface SensitivityCell {
  revenue: number;
  marginPct: number;
  comp: number;
  compPctRevenue: number;
  compPctGP: number;
  gpAfterComp: number;
}

/** Scales the current team's sales (keeping proportions) to each revenue level. */
export function sensitivityTable(
  plan: CompensationPlan,
  scenario: StoreScenario,
  employees: Employee[],
  revenues = SENSITIVITY_REVENUES,
  margins = SENSITIVITY_MARGINS,
): SensitivityCell[] {
  const cells: SensitivityCell[] = [];
  for (const revenue of revenues) {
    const emps = distributeRevenue(employees, revenue, "proportional");
    for (const marginPct of margins) {
      const res = calculatePlan(plan, { ...scenario, storeRevenueMode: "manual", storeRevenue: revenue, grossMarginPct: marginPct }, emps);
      cells.push({
        revenue,
        marginPct,
        comp: res.totals.total,
        compPctRevenue: res.compPctRevenue,
        compPctGP: res.compPctGP,
        gpAfterComp: res.gpAfterComp,
      });
    }
  }
  return cells;
}

export interface StaffingRow {
  salespeople: number;
  revenuePerPerson: number;
  gpPerPerson: number;
  opportunitiesPerPerson: number;
  totalComp: number;
  avgComp: number;
  compPctGP: number;
}

export function staffingTable(
  plan: CompensationPlan,
  scenario: StoreScenario,
  revenue: number,
  counts = [3, 4, 5, 6, 7, 8],
  opts: { tenureYears?: number; mix?: Record<Department, number> } = {},
): StaffingRow[] {
  const monthlyCustomers = scenario.customersPerDay * scenario.openDaysPerMonth;
  const gp = storeGPOf(revenue, scenario);
  return counts.map((n) => {
    const res = companyCostAt(plan, scenario, revenue, n, opts);
    return {
      salespeople: n,
      revenuePerPerson: revenue / n,
      gpPerPerson: gp / n,
      opportunitiesPerPerson: monthlyCustomers / n,
      totalComp: res.totals.total,
      avgComp: res.avgCompPerSalesperson,
      compPctGP: res.compPctGP,
    };
  });
}

// ---------------------------------------------------------------- Incentive analysis

export const PRODUCTION_LEVELS = [20000, 30000, 40000, 50000, 60000, 70000, 80000, 100000];

export interface ProductionRow {
  sales: number;
  proposed: ReferencePay;
  current: ReferencePay;
  difference: number;
}

export function productionTable(
  plan: CompensationPlan,
  current: CompensationPlan,
  scenario: StoreScenario,
  opts: ReferenceOptions = {},
  levels = PRODUCTION_LEVELS,
): ProductionRow[] {
  return levels.map((sales) => {
    const proposed = referencePay(plan, scenario, sales, opts);
    const cur = referencePay(current, scenario, sales, { ...opts, track: "stability" });
    return { sales, proposed, current: cur, difference: proposed.total - cur.total };
  });
}

/** Change in pay when one salesperson discounts all sales by `discountPct` (cost unchanged). */
export function discountImpact(
  plan: CompensationPlan,
  scenario: StoreScenario,
  sales: number,
  discountPct: number,
  opts: ReferenceOptions = {},
) {
  const f = discountPct / 100;
  const discountedSales = sales * (1 - f);
  const margins = Object.fromEntries(
    DEPARTMENTS.map((d) => {
      const m = resolveMargin(scenario, d) / 100;
      // Same cost, lower price: new margin = (price*(1-f) - cost) / (price*(1-f))
      return [d, ((m - f) / (1 - f)) * 100];
    }),
  ) as Record<Department, number>;
  const discountedScenario: StoreScenario = { ...scenario, departmentMargins: margins };
  const full = referencePay(plan, scenario, sales, opts);
  const disc = referencePay(plan, scenario, discountedSales, { ...opts, scenario: discountedScenario });
  const mix = opts.mix ?? storeDepartmentMix([]);
  const gpFull = DEPARTMENTS.reduce((s, d) => s + sales * (mix[d] || 0) * (resolveMargin(scenario, d) / 100), 0);
  const gpDisc = gpFull - sales * f;
  return {
    sales,
    discountedSales,
    gpFull,
    gpDisc,
    gpChangePct: gpFull > 0 ? ((gpDisc - gpFull) / gpFull) * 100 : 0,
    payFull: full.total,
    payDisc: disc.total,
    variableFull: full.variable,
    variableDisc: disc.variable,
    variableChangePct: full.variable > 0 ? ((disc.variable - full.variable) / full.variable) * 100 : 0,
  };
}

export interface AnalysisSection {
  title: string;
  observations: string[];
}

function signedMoney(n: number) {
  return `${n >= 0 ? "" : "-"}${money(Math.abs(n))}`;
}

function moreLess(n: number) {
  if (Math.abs(n) < 1) return "about the same as";
  return `${money(Math.abs(n))} ${n > 0 ? "more than" : "less than"}`;
}

export function incentiveAnalysis(
  plan: CompensationPlan,
  current: CompensationPlan,
  scenario: StoreScenario,
  employees: Employee[],
  opts: ReferenceOptions = {},
): AnalysisSection[] {
  const mix = opts.mix ?? storeDepartmentMix(employees);
  const headcount = opts.headcount ?? Math.max(1, employees.length);
  const managerCount = opts.managerCount ?? employees.filter((e) => e.isManager).length;
  // People this plan actually pays (managers excluded when they are paid separately).
  const payHeadcount = Math.max(1, headcount - (plan.managersPaidSeparately ? managerCount : 0));
  const storeRevenue = opts.storeRevenue ?? calculatePlan(plan, scenario, employees).storeRevenue;
  const o: ReferenceOptions = { ...opts, mix, headcount, managerCount, storeRevenue };
  const tracks = tracksFor(plan);
  const trackName = (t: Track) => (plan.tracks.enabled ? ` (${plan.tracks[t].label})` : "");
  const at = (s: number, t: Track = tracks[0]) => referencePay(plan, scenario, s, { ...o, track: t });
  const cur = (s: number) => referencePay(current, scenario, s, { ...o, track: "stability" });
  const result = calculatePlan(plan, scenario, employees);
  const currentResult = calculatePlan(current, scenario, employees);
  const sections: AnalysisSection[] = [];

  // 1. Income stability
  {
    const obs: string[] = [];
    for (const t of tracks) {
      for (const s of [40000, 70000]) {
        const p = at(s, t);
        obs.push(
          `Under this plan${trackName(t)}, ${pct(p.guaranteedPct, 0)} of compensation for a ${money(s)} salesperson is guaranteed base pay (${money(p.basePay)} of ${money(p.total)}).`,
        );
      }
    }
    obs.push(
      `Across the current team, ${pct(result.guaranteedPct, 0)} of total sales compensation is guaranteed base pay (current plan: ${pct(currentResult.guaranteedPct, 0)}).`,
    );
    const diff = result.guaranteedPct - currentResult.guaranteedPct;
    if (Math.abs(diff) >= 1)
      obs.push(
        diff < 0
          ? "This plan places more compensation at risk than the current plan."
          : "This plan makes employee earnings more stable than the current plan.",
      );
    sections.push({ title: "Income stability", observations: obs });
  }

  // 2. Individual incentive
  {
    const obs: string[] = [];
    for (const t of tracks) {
      for (const [a, b] of [
        [40000, 50000],
        [50000, 60000],
        [60000, 70000],
        [70000, 80000],
        [80000, 100000],
      ]) {
        const gain = at(b, t).total - at(a, t).total;
        obs.push(
          `Moving from ${money(a)} to ${money(b)}${trackName(t)} adds ${signedMoney(gain)} per month (${pct((gain / (b - a)) * 100, 1)} of the added sales).`,
        );
      }
    }
    const pGain = at(70000).total - at(40000).total;
    const cGain = cur(70000).total - cur(40000).total;
    obs.push(
      Math.abs(pGain - cGain) < 1
        ? "Going from $40k to $70k is rewarded about the same as under the current plan."
        : pGain > cGain
          ? `This plan creates stronger individual incentives between $40k and $70k: ${money(pGain)} vs ${money(cGain)} under the current plan.`
          : `This plan creates weaker individual incentives between $40k and $70k: ${money(pGain)} vs ${money(cGain)} under the current plan.`,
    );
    sections.push({ title: "Individual incentive", observations: obs });
  }

  // 3. Team incentive
  {
    const obs: string[] = [];
    if (!plan.team.enabled && !plan.bonuses.some(isStoreBonus) && !["storeRevenue", "storeGP"].includes(plan.commission.basis)) {
      obs.push("No compensation in this plan depends on total store results.");
    } else {
      for (const r of SENSITIVITY_REVENUES) {
        const pp = companyCostAt(plan, scenario, r, payHeadcount, { mix, tenureYears: o.tenureYears });
        const team = pp.totals.teamBonus / payHeadcount;
        obs.push(
          plan.team.enabled && plan.team.distribution === "equal"
            ? `At ${money(r)} store revenue, each salesperson receives a ${money(team)} team bonus.`
            : `At ${money(r)} store revenue, the team component averages ${money(team)} per salesperson (${money(pp.totals.teamBonus)} total).`,
        );
      }
    }
    obs.push(
      `In this scenario, approximately ${pct(result.teamShareOfVariablePct, 0)} of variable compensation is tied to team/store performance.`,
    );
    if (plan.team.enabled && plan.team.distribution !== "equal")
      obs.push(`The team pool is split by "${plan.team.distribution}", so individual shares differ from the average shown above.`);
    sections.push({ title: "Team incentive", observations: obs });
  }

  // 4. Tenure incentive
  {
    const obs: string[] = [];
    const t0 = referencePay(plan, scenario, 50000, { ...o, tenureYears: 0 }).total;
    const t3 = referencePay(plan, scenario, 50000, { ...o, tenureYears: 3 }).total;
    const t5 = referencePay(plan, scenario, 50000, { ...o, tenureYears: 5 }).total;
    const t10 = referencePay(plan, scenario, 50000, { ...o, tenureYears: 10 }).total;
    if (Math.abs(t10 - t0) < 1) obs.push("Tenure does not change compensation under this plan.");
    else {
      obs.push(
        `At $50k in sales, a 3-year salesperson earns ${money(t3 - t0)} more per month than a new hire; 5 years: ${money(t5 - t0)}; 10 years: ${money(t10 - t0)}.`,
      );
      if (plan.base.tenureCap !== null && plan.base.tenureRaisePerYear > 0) {
        const years = Math.ceil((plan.base.tenureCap - plan.base.hourlyRate) / plan.base.tenureRaisePerYear);
        obs.push(`Tenure raises stop at ${money(plan.base.tenureCap, 2)}/hour, reached after about ${years} completed years.`);
      }
    }
    const withOverride = employees.filter((e) => e.hourlyWageOverride !== null);
    if (withOverride.length)
      obs.push(`${withOverride.map((e) => e.name).join(", ")} ha${withOverride.length > 1 ? "ve" : "s"} an hourly wage override, which replaces tenure-based rates.`);
    sections.push({ title: "Tenure incentive", observations: obs });
  }

  // 5. Margin protection
  {
    const obs: string[] = [];
    const d = discountImpact(plan, scenario, 50000, 10, { ...o, track: tracks[0] });
    const c = discountImpact(current, scenario, 50000, 10, { ...o, track: "stability" });
    obs.push(
      `If a $50k producer discounts every sale by 10% (same cost), store gross profit on those sales falls ${pct(Math.abs(d.gpChangePct), 0)} (${money(d.gpFull)} → ${money(d.gpDisc)}).`,
    );
    obs.push(
      `Under this plan, that salesperson's variable pay changes by ${signedMoney(d.variableDisc - d.variableFull)} (${pct(d.variableChangePct, 0)}). Under the current plan: ${signedMoney(c.variableDisc - c.variableFull)} (${pct(c.variableChangePct, 0)}).`,
    );
    const gpLinked =
      plan.commission.basis.includes("GP") ||
      (plan.departmentCommission.enabled && DEPARTMENTS.some((dd) => plan.departmentCommission.rules[dd].method === "grossProfit")) ||
      plan.bonuses.some((b) => b.trigger.includes("GP")) ||
      (plan.team.enabled && (plan.team.poolType === "gpPercent" || plan.team.poolType === "gpAboveTarget"));
    obs.push(
      gpLinked
        ? "Part of this plan is measured on gross profit, so protecting margin directly affects pay."
        : "This plan is measured on revenue, so pay does not directly reflect the margin on each sale.",
    );
    if (DEPARTMENTS.every((dd) => scenario.departmentMargins[dd] === null))
      obs.push("Department margins are blank, so all gross profit uses the storewide margin.");
    sections.push({ title: "Margin protection", observations: obs });
  }

  // 6. Cliffs
  {
    const cliffs = detectCliffs(plan, scenario, o).filter((c) => c.size !== "None");
    const obs = cliffs.length
      ? cliffs
          .filter((c) => c.kind === "personal")
          .map((c) => `The ${money(c.at)} threshold (${c.source}) creates a ${money(c.jump)} compensation jump (${c.size.toLowerCase()}).`)
      : ["No compensation jumps of $5 or more were found at any threshold."];
    const storeCliffs = cliffs.filter((c) => c.kind === "store");
    if (storeCliffs.length)
      obs.push(
        `${storeCliffs.length} store-revenue threshold${storeCliffs.length > 1 ? "s" : ""} also create jumps (largest: ${money(Math.max(...storeCliffs.map((c) => c.companyJump ?? 0)))} company-wide).`,
      );
    sections.push({ title: "Commission cliffs", observations: obs });
  }

  // 7-10. Production levels
  const levelSection = (title: string, levels: number[]) => {
    const obs: string[] = [];
    for (const t of tracks) {
      for (const s of levels) {
        const p = at(s, t);
        const c = cur(s);
        obs.push(
          `At ${money(s)}${trackName(t)}: ${money(p.total)} per month (${money(p.basePay)} base + ${money(p.variable)} variable). This plan pays a ${money(s)} producer ${moreLess(p.total - c.total)} the current plan (${money(c.total)}).`,
        );
      }
    }
    sections.push({ title, observations: obs });
  };
  levelSection("Low-production month", [20000, 30000, 40000]);
  levelSection("Normal production", [50000, 60000]);
  levelSection("Strong production", [70000, 80000]);
  levelSection("Exceptional production", [100000]);

  // Company cost
  {
    const diff = result.totals.total - currentResult.totals.total;
    sections.push({
      title: "Company cost",
      observations: [
        Math.abs(diff) < 1
          ? "This plan costs about the same as the current structure in this scenario."
          : `This plan ${diff > 0 ? "increases" : "decreases"} company compensation expense by ${money(Math.abs(diff))} per month compared with the current structure (${money(currentResult.totals.total)} → ${money(result.totals.total)}).`,
        `Sales compensation is ${pct(result.compPctRevenue, 1)} of revenue and ${pct(result.compPctGP, 1)} of estimated gross profit (current plan: ${pct(currentResult.compPctRevenue, 1)} / ${pct(currentResult.compPctGP, 1)}).`,
      ],
    });
  }
  return sections;
}

// ---------------------------------------------------------------- Side-by-side metrics

export interface PlanMetrics {
  planId: string;
  result: CalculationResult;
  /** Extra monthly pay going from $50k to $70k personal sales. */
  individualIncentive: number;
  /** Change in average per-person pay when store revenue goes from $225k to $275k at equal splits. */
  teamIncentive: number;
  teamSharePct: number;
  /** Guaranteed share of pay for a $40k producer. */
  stabilityPct: number;
  cliffCount: number;
  largestCliff: number;
}

export function planMetrics(
  plan: CompensationPlan,
  scenario: StoreScenario,
  employees: Employee[],
): PlanMetrics {
  const mix = storeDepartmentMix(employees);
  const headcount = Math.max(1, employees.length);
  const managerCount = employees.filter((e) => e.isManager).length;
  const result = calculatePlan(plan, scenario, employees);
  const o: ReferenceOptions = { mix, headcount, managerCount, storeRevenue: result.storeRevenue };
  const tracks = tracksFor(plan);
  const avg = (f: (t: Track) => number) => tracks.reduce((s, t) => s + f(t), 0) / tracks.length;
  const individualIncentive = avg(
    (t) => referencePay(plan, scenario, 70000, { ...o, track: t }).total - referencePay(plan, scenario, 50000, { ...o, track: t }).total,
  );
  // Team incentive: store-linked pay only, holding personal sales at $50k.
  const teamAt = (r: number) =>
    avg((t) => referencePay(plan, scenario, 50000, { ...o, track: t, storeRevenue: r }).teamBonus) +
    (["storeRevenue", "storeGP"].includes(plan.commission.basis)
      ? avg(
          (t) =>
            referencePay(plan, scenario, 50000, { ...o, track: t, storeRevenue: r }).commission,
        )
      : 0);
  const cliffs = detectCliffs(plan, scenario, o).filter((c) => c.size !== "None");
  return {
    planId: plan.id,
    result,
    individualIncentive,
    teamIncentive: teamAt(275000) - teamAt(225000),
    teamSharePct: result.teamShareOfVariablePct,
    stabilityPct: avg((t) => referencePay(plan, scenario, 40000, { ...o, track: t }).guaranteedPct),
    cliffCount: cliffs.length,
    largestCliff: cliffs.reduce((m, c) => Math.max(m, Math.abs(c.jump)), 0),
  };
}

// Re-exported helpers used by the UI.
export { bonusAmount, commissionOnAmount, personalGP, teamWeights };
