// Pure compensation math. No React, no browser APIs - everything here is unit-tested.
import {
  DEPARTMENTS,
  type Bonus,
  type CalculationResult,
  type CommissionRule,
  type CommissionStyle,
  type CommissionTier,
  type CompensationPlan,
  type Department,
  type DepartmentSales,
  type Employee,
  type EmployeeResult,
  type StoreScenario,
} from "./types";

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function sortTiers(tiers: CommissionTier[]): CommissionTier[] {
  return [...tiers].sort((a, b) => a.threshold - b.threshold);
}

/**
 * Commission on an amount (sales or gross profit).
 *  - flat: amount x flat rate
 *  - retroactive: the highest tier reached applies to the ENTIRE amount
 *  - marginal: each tier's rate applies only to dollars inside that bracket
 * A tier applies once amount >= threshold.
 */
export function commissionOnAmount(
  amount: number,
  style: CommissionStyle,
  flatRatePct: number,
  tiers: CommissionTier[],
): number {
  if (amount <= 0) return 0;
  if (style === "flat") return (amount * flatRatePct) / 100;

  const sorted = sortTiers(tiers);
  if (style === "retroactive") {
    let rate = 0;
    for (const t of sorted) if (amount >= t.threshold) rate = t.ratePct;
    return (amount * rate) / 100;
  }

  let total = 0;
  for (let i = 0; i < sorted.length; i++) {
    const lo = sorted[i].threshold;
    const hi = i + 1 < sorted.length ? sorted[i + 1].threshold : Infinity;
    const portion = Math.min(amount, hi) - lo;
    if (portion > 0) total += (portion * sorted[i].ratePct) / 100;
  }
  return total;
}

/** The rate in effect at a given amount (for display). */
export function rateAt(amount: number, rule: Pick<CommissionRule, "style" | "flatRatePct" | "tiers">): number {
  if (rule.style === "flat") return rule.flatRatePct;
  let rate = 0;
  for (const t of sortTiers(rule.tiers)) if (amount >= t.threshold) rate = t.ratePct;
  return rate;
}

export function departmentTotal(sales: DepartmentSales): number {
  return DEPARTMENTS.reduce((s, d) => s + (sales[d] || 0), 0);
}

export function personalSales(emp: Employee): number {
  return emp.useDepartmentTotal ? departmentTotal(emp.sales) : emp.manualPersonalSales || 0;
}

export function resolveMargin(scenario: StoreScenario, dept: Department): number {
  const m = scenario.departmentMargins[dept];
  return m === null || m === undefined || Number.isNaN(m) ? scenario.grossMarginPct : m;
}

export function departmentGP(emp: Employee, scenario: StoreScenario, dept: Department): number {
  return ((emp.sales[dept] || 0) * resolveMargin(scenario, dept)) / 100;
}

/** Personal gross profit: department sales x department margins (blank margins use the storewide margin). */
export function personalGP(emp: Employee, scenario: StoreScenario): number {
  const deptSales = departmentTotal(emp.sales);
  const deptGP = DEPARTMENTS.reduce((s, d) => s + departmentGP(emp, scenario, d), 0);
  if (emp.useDepartmentTotal) return deptGP;
  const blended = deptSales > 0 ? deptGP / deptSales : scenario.grossMarginPct / 100;
  return (emp.manualPersonalSales || 0) * blended;
}

export function storeRevenueOf(scenario: StoreScenario, employees: Employee[]): number {
  return scenario.storeRevenueMode === "employees"
    ? employees.reduce((s, e) => s + personalSales(e), 0)
    : scenario.storeRevenue;
}

export function storeGPOf(storeRevenue: number, scenario: StoreScenario): number {
  return (storeRevenue * scenario.grossMarginPct) / 100;
}

export function hourlyRateFor(emp: Employee, plan: CompensationPlan): number {
  if (plan.base.type !== "hourly") return 0;
  if (emp.hourlyWageOverride !== null && emp.hourlyWageOverride !== undefined) return emp.hourlyWageOverride;
  if (plan.tracks.enabled) return plan.tracks[emp.track].hourlyRate;
  const years = Math.max(0, Math.floor(emp.tenureYears || 0));
  let rate = plan.base.hourlyRate + years * (plan.base.tenureRaisePerYear || 0);
  if (plan.base.tenureCap !== null && plan.base.tenureCap !== undefined && plan.base.tenureRaisePerYear > 0) {
    rate = Math.min(rate, Math.max(plan.base.tenureCap, plan.base.hourlyRate));
  }
  return rate;
}

export function basePayFor(emp: Employee, plan: CompensationPlan): number {
  if (plan.base.type === "salary") return plan.base.monthlySalary;
  if (plan.base.type === "hourly") return hourlyRateFor(emp, plan) * (emp.hoursWorked || 0);
  return 0;
}

export interface StoreContext {
  storeRevenue: number;
  storeGP: number;
}

export function commissionRuleFor(emp: Employee, plan: CompensationPlan): CommissionRule {
  return plan.tracks.enabled ? plan.tracks[emp.track].commission : plan.commission;
}

/**
 * Commission on only the portion of personal sales above a threshold, at department rates.
 * The excess is allocated across departments in proportion to the person's department sales,
 * so nothing is paid retroactively on the first `excessThreshold` dollars.
 */
export function excessByDepartmentCommission(emp: Employee, rule: CommissionRule): number {
  const excess = personalSales(emp) - (rule.excessThreshold ?? 0);
  const deptTotal = departmentTotal(emp.sales);
  if (excess <= 0 || deptTotal <= 0) return 0;
  return DEPARTMENTS.reduce(
    (s, d) => s + (excess * (emp.sales[d] || 0) * (rule.departmentRatesPct?.[d] ?? 0)) / deptTotal / 100,
    0,
  );
}

function isStoreBasis(rule: CommissionRule) {
  return rule.basis === "storeRevenue" || rule.basis === "storeGP";
}

export function personalCommissionFor(
  emp: Employee,
  plan: CompensationPlan,
  scenario: StoreScenario,
  ctx: StoreContext,
): number {
  const rule = commissionRuleFor(emp, plan);
  if (!rule.enabled) return 0;
  const calc = (amt: number) => commissionOnAmount(amt, rule.style, rule.flatRatePct, rule.tiers);
  switch (rule.basis) {
    case "personalRevenue":
      return calc(personalSales(emp));
    case "personalExcessByDepartment":
      return excessByDepartmentCommission(emp, rule);
    case "personalGP":
      return calc(personalGP(emp, scenario));
    case "departmentRevenue":
      return DEPARTMENTS.reduce((s, d) => s + calc(emp.sales[d] || 0), 0);
    case "departmentGP":
      return DEPARTMENTS.reduce((s, d) => s + calc(departmentGP(emp, scenario, d)), 0);
    case "storeRevenue":
      return calc(ctx.storeRevenue);
    case "storeGP":
      return calc(ctx.storeGP);
  }
}

export function departmentCommissionFor(emp: Employee, plan: CompensationPlan, scenario: StoreScenario): number {
  if (!plan.departmentCommission.enabled) return 0;
  return DEPARTMENTS.reduce((s, d) => {
    const r = plan.departmentCommission.rules[d];
    const amt = r.method === "grossProfit" ? departmentGP(emp, scenario, d) : emp.sales[d] || 0;
    return s + commissionOnAmount(amt, r.style, r.flatRatePct, r.tiers);
  }, 0);
}

export function isStoreBonus(b: Bonus) {
  return b.trigger === "storeSales" || b.trigger === "storeGP";
}

export function bonusMetric(b: Bonus, emp: Employee, scenario: StoreScenario, ctx: StoreContext): number {
  switch (b.trigger) {
    case "personalSales":
      return personalSales(emp);
    case "personalGP":
      return personalGP(emp, scenario);
    case "storeSales":
      return ctx.storeRevenue;
    case "storeGP":
      return ctx.storeGP;
    case "departmentSales":
      return b.department ? emp.sales[b.department] || 0 : 0;
    case "departmentGP":
      return b.department ? departmentGP(emp, scenario, b.department) : 0;
  }
}

export function bonusAmount(b: Bonus, metric: number): number {
  if (metric < b.threshold || metric <= 0) return 0;
  return b.type === "flat" ? b.amount : (metric * b.amount) / 100;
}

export interface IndividualPay {
  hourlyRate: number;
  basePay: number;
  personalCommission: number;
  departmentCommission: number;
  individualBonuses: number;
  storeBonuses: number;
  /** Portion of personalCommission that depends on store results. */
  storeLinkedCommission: number;
}

/** Everything except the shared team pool. */
export function individualPay(
  emp: Employee,
  plan: CompensationPlan,
  scenario: StoreScenario,
  ctx: StoreContext,
): IndividualPay {
  let individualBonuses = 0;
  let storeBonuses = 0;
  for (const b of plan.bonuses) {
    const amt = bonusAmount(b, bonusMetric(b, emp, scenario, ctx));
    if (isStoreBonus(b)) storeBonuses += amt;
    else individualBonuses += amt;
  }
  const personalCommission = personalCommissionFor(emp, plan, scenario, ctx);
  return {
    hourlyRate: hourlyRateFor(emp, plan),
    basePay: basePayFor(emp, plan),
    personalCommission,
    departmentCommission: departmentCommissionFor(emp, plan, scenario),
    individualBonuses,
    storeBonuses,
    storeLinkedCommission: isStoreBasis(commissionRuleFor(emp, plan)) ? personalCommission : 0,
  };
}

/** Total team pool (dollars) before distribution. */
export function teamPool(plan: CompensationPlan, scenario: StoreScenario, ctx: StoreContext, headcount: number): number {
  const t = plan.team;
  if (!t.enabled || headcount <= 0) return 0;
  switch (t.poolType) {
    case "fixedThreshold":
      return teamPerPersonAtThreshold(plan, ctx.storeRevenue) * headcount;
    case "revenuePercent":
      return (ctx.storeRevenue * t.poolRatePct) / 100;
    case "gpPercent":
      return (ctx.storeGP * t.poolRatePct) / 100;
    case "revenueAboveBreakEven":
      return (Math.max(0, ctx.storeRevenue - scenario.estimatedBreakEvenRevenue) * t.poolRatePct) / 100;
    case "gpAboveTarget":
      return (Math.max(0, ctx.storeGP - t.gpTarget) * t.poolRatePct) / 100;
  }
}

/** For fixed-threshold team bonuses: dollars per person at the highest threshold reached. */
export function teamPerPersonAtThreshold(plan: CompensationPlan, storeRevenue: number): number {
  let amt = 0;
  for (const th of [...plan.team.thresholds].sort((a, b) => a.threshold - b.threshold)) {
    if (storeRevenue >= th.threshold) amt = th.amountPerPerson;
  }
  return amt;
}

/** Share of the team pool each employee receives (sums to 1). */
export function teamWeights(plan: CompensationPlan, employees: Employee[]): number[] {
  const n = employees.length;
  if (n === 0) return [];
  const equal = employees.map(() => 1 / n);
  const normalize = (raw: number[]) => {
    const sum = raw.reduce((s, x) => s + Math.max(0, x), 0);
    return sum > 0 ? raw.map((x) => Math.max(0, x) / sum) : equal;
  };
  switch (plan.team.distribution) {
    case "equal":
      return equal;
    case "hours":
      return normalize(employees.map((e) => e.hoursWorked || 0));
    case "sales":
      return normalize(employees.map(personalSales));
    case "custom":
      return normalize(employees.map((e) => e.teamWeight ?? 1));
    case "blended": {
      const w = Math.min(100, Math.max(0, plan.team.salesWeightPct)) / 100;
      const bySales = normalize(employees.map(personalSales));
      return employees.map((_, i) => (1 - w) / n + w * bySales[i]);
    }
  }
}

/** True when this plan does not pay this employee (manager compensated separately). */
export function isPaidSeparately(emp: Employee, plan: CompensationPlan): boolean {
  return !!plan.managersPaidSeparately && !!emp.isManager;
}

export function calculatePlan(
  plan: CompensationPlan,
  scenario: StoreScenario,
  employees: Employee[],
): CalculationResult {
  const storeRevenue = storeRevenueOf(scenario, employees);
  const storeGP = storeGPOf(storeRevenue, scenario);
  const ctx: StoreContext = { storeRevenue, storeGP };
  // Store revenue above includes everyone (managers too); pay and the pool split cover participants only.
  const participants = employees.filter((e) => !isPaidSeparately(e, plan));
  const headcount = participants.length;
  const pool = teamPool(plan, scenario, ctx, headcount);
  const weights = teamWeights(plan, participants);
  const weightById = new Map(participants.map((e, i) => [e.id, weights[i]]));

  const results: EmployeeResult[] = employees.map((emp) => {
    if (isPaidSeparately(emp, plan)) {
      return {
        employeeId: emp.id,
        name: emp.name,
        personalSales: personalSales(emp),
        personalGP: personalGP(emp, scenario),
        hourlyRate: 0,
        basePay: 0,
        personalCommission: 0,
        departmentCommission: 0,
        individualBonuses: 0,
        teamBonus: 0,
        total: 0,
        storeLinkedPay: 0,
        paidSeparately: true,
      };
    }
    const ind = individualPay(emp, plan, scenario, ctx);
    const teamShare = pool * (weightById.get(emp.id) ?? 0);
    const teamBonus = teamShare + ind.storeBonuses;
    const total = ind.basePay + ind.personalCommission + ind.departmentCommission + ind.individualBonuses + teamBonus;
    return {
      employeeId: emp.id,
      name: emp.name,
      personalSales: personalSales(emp),
      personalGP: personalGP(emp, scenario),
      hourlyRate: ind.hourlyRate,
      basePay: round2(ind.basePay),
      personalCommission: round2(ind.personalCommission),
      departmentCommission: round2(ind.departmentCommission),
      individualBonuses: round2(ind.individualBonuses),
      teamBonus: round2(teamBonus),
      total: round2(total),
      storeLinkedPay: round2(teamBonus + ind.storeLinkedCommission),
    };
  });

  const sum = (k: keyof EmployeeResult) => round2(results.reduce((s, r) => s + (r[k] as number), 0));
  const totals = {
    basePay: sum("basePay"),
    personalCommission: sum("personalCommission"),
    departmentCommission: sum("departmentCommission"),
    individualBonuses: sum("individualBonuses"),
    teamBonus: sum("teamBonus"),
    total: sum("total"),
  };
  const variable = totals.total - totals.basePay;
  const storeLinked = sum("storeLinkedPay");

  return {
    planId: plan.id,
    employees: results,
    totals,
    storeRevenue,
    storeGP,
    headcount,
    compPctRevenue: storeRevenue > 0 ? (totals.total / storeRevenue) * 100 : 0,
    compPctGP: storeGP > 0 ? (totals.total / storeGP) * 100 : 0,
    gpAfterComp: storeGP - totals.total,
    revenuePerSalesperson: headcount ? storeRevenue / headcount : 0,
    gpPerSalesperson: headcount ? storeGP / headcount : 0,
    avgCompPerSalesperson: headcount ? totals.total / headcount : 0,
    guaranteedPct: totals.total > 0 ? (totals.basePay / totals.total) * 100 : 0,
    teamShareOfVariablePct: variable > 0 ? (storeLinked / variable) * 100 : 0,
  };
}

/** Payroll for regular sales staff: everyone except employees flagged as managers. */
export function regularStaffPayroll(result: CalculationResult, employees: Employee[]): number {
  const managers = new Set(employees.filter((e) => e.isManager).map((e) => e.id));
  return round2(result.employees.reduce((a, r) => a + (managers.has(r.employeeId) ? 0 : r.total), 0));
}
