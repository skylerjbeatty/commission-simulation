// Built-in plan presets. Every number here is a starting point and is editable in the app,
// except CURRENT GUION'S PLAN, which is locked.
import {
  DEPARTMENTS,
  type Bonus,
  type CommissionRule,
  type CommissionTier,
  type CompensationPlan,
  type Department,
  type DepartmentPlan,
  type DepartmentRule,
  type TeamPlan,
  type TeamThreshold,
} from "./types";

let counter = 0;
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const CURRENT_PLAN_ID = "preset_current";

const tiers = (pairs: [number, number][]): CommissionTier[] =>
  pairs.map(([threshold, ratePct], i) => ({ id: `t${i}_${threshold}`, threshold, ratePct }));

const commission = (pairs: [number, number][], overrides: Partial<CommissionRule> = {}): CommissionRule => ({
  enabled: true,
  basis: "personalRevenue",
  style: "retroactive",
  flatRatePct: 0,
  tiers: tiers(pairs),
  ...overrides,
});

const noCommission = (): CommissionRule => ({
  enabled: false,
  basis: "personalRevenue",
  style: "retroactive",
  flatRatePct: 0,
  tiers: [],
});

const bonus = (label: string, threshold: number, amount: number, extra: Partial<Bonus> = {}): Bonus => ({
  id: `b_${threshold}_${label.replace(/\W+/g, "")}`,
  label,
  trigger: "personalSales",
  threshold,
  type: "flat",
  amount,
  ...extra,
});

const teamThresholds = (pairs: [number, number][]): TeamThreshold[] =>
  pairs.map(([threshold, amountPerPerson], i) => ({ id: `tt${i}_${threshold}`, threshold, amountPerPerson }));

export const HYBRID_TEAM_THRESHOLDS: [number, number][] = [
  [225000, 100],
  [250000, 200],
  [275000, 300],
  [300000, 400],
];

const teamOff = (): TeamPlan => ({
  enabled: false,
  poolType: "fixedThreshold",
  thresholds: teamThresholds(HYBRID_TEAM_THRESHOLDS),
  poolRatePct: 1,
  gpTarget: 76000,
  distribution: "equal",
  salesWeightPct: 25,
});

const hybridTeam = (): TeamPlan => ({ ...teamOff(), enabled: true });

const deptRule = (flatRatePct = 0, method: DepartmentRule["method"] = "revenue"): DepartmentRule => ({
  method,
  style: "flat",
  flatRatePct,
  tiers: [],
});

const deptPlan = (enabled: boolean, rates?: Partial<Record<Department, number>>): DepartmentPlan => ({
  enabled,
  rules: Object.fromEntries(DEPARTMENTS.map((d) => [d, deptRule(rates?.[d] ?? 0)])) as Record<
    Department,
    DepartmentRule
  >,
});

const tracksOff = () => ({
  enabled: false,
  stability: { label: "Stability Track", hourlyRate: 17, commission: noCommission() },
  performance: { label: "Performance Track", hourlyRate: 13, commission: noCommission() },
});

const hourly = (rate: number) => ({
  type: "hourly" as const,
  hourlyRate: rate,
  monthlySalary: 0,
  tenureRaisePerYear: 0,
  tenureCap: null,
});

function makePlan(p: Partial<CompensationPlan> & Pick<CompensationPlan, "id" | "name" | "description">): CompensationPlan {
  return {
    locked: false,
    experimental: false,
    presetId: p.id,
    base: hourly(15),
    commission: noCommission(),
    departmentCommission: deptPlan(false),
    bonuses: [],
    team: teamOff(),
    tracks: tracksOff(),
    ...p,
  };
}

export function buildPresets(): CompensationPlan[] {
  return [
    makePlan({
      id: CURRENT_PLAN_ID,
      name: "CURRENT GUION'S PLAN",
      description:
        "$15/hour. 2% of ALL monthly personal sales at $45,000; 3% of ALL sales at $70,000. Rates are retroactive to the first dollar once a threshold is reached.",
      locked: true,
      commission: commission([
        [45000, 2],
        [70000, 3],
      ]),
    }),
    makePlan({
      id: "preset_tiered_hybrid",
      name: "TIERED HYBRID",
      description:
        "$15/hour. Retroactive tiers from 1% at $30k to 3% at $70k, $500 performance bonuses at $80k and $100k, plus a per-person team bonus at store revenue thresholds.",
      commission: commission([
        [30000, 1],
        [40000, 1.5],
        [50000, 2],
        [60000, 2.5],
        [70000, 3],
      ]),
      bonuses: [bonus("$80k personal sales", 80000, 500), bonus("$100k personal sales", 100000, 500)],
      team: hybridTeam(),
    }),
    makePlan({
      id: "preset_team_first",
      name: "TEAM FIRST",
      description:
        "$15/hour. A team pool of 1.5% of store revenue, split mostly equally (80% equal / 20% by personal sales), plus smaller individual bonuses at $50k, $70k, $80k and $100k.",
      team: {
        ...teamOff(),
        enabled: true,
        poolType: "revenuePercent",
        poolRatePct: 1.5,
        distribution: "blended",
        salesWeightPct: 20,
      },
      bonuses: [
        bonus("$50k personal sales", 50000, 200),
        bonus("$70k personal sales", 70000, 200),
        bonus("$80k personal sales", 80000, 200),
        bonus("$100k personal sales", 100000, 400),
      ],
    }),
    makePlan({
      id: "preset_performance_first",
      name: "PERFORMANCE FIRST",
      description:
        "$15/hour. Aggressive retroactive tiers from 1% at $30k up to 4% at $100k. No team bonus.",
      commission: commission([
        [30000, 1],
        [40000, 1.5],
        [50000, 2],
        [60000, 2.5],
        [70000, 3],
        [80000, 3.5],
        [100000, 4],
      ]),
    }),
    makePlan({
      id: "preset_gp_commission",
      name: "GROSS PROFIT COMMISSION",
      description:
        "$15/hour. Commission is paid on gross profit generated (revenue - cost), not revenue, so discounting reduces commission. Tiers are measured in monthly personal gross profit.",
      commission: commission(
        [
          [10000, 4],
          [15000, 5],
          [20000, 6],
          [25000, 7],
        ],
        { basis: "personalGP" },
      ),
    }),
    makePlan({
      id: "preset_department",
      name: "DEPARTMENT COMMISSION",
      description:
        "$15/hour. A different commission rate for each department. Each department can pay on revenue or gross profit, flat or tiered. Optional personal and team bonuses.",
      departmentCommission: deptPlan(true, {
        appliances: 1.5,
        furniture: 3,
        mattresses: 4,
        protection: 8,
        other: 2,
      }),
      bonuses: [bonus("$80k personal sales", 80000, 500)],
    }),
    makePlan({
      id: "preset_tenure",
      name: "TENURE + COMMISSION",
      description:
        "Starting wage $13/hour, +$1/hour per completed year of tenure, capped at $18/hour. Retroactive commission from 1% at $30k to 3% at $70k. Team bonus available (off by default).",
      base: { ...hourly(13), tenureRaisePerYear: 1, tenureCap: 18 },
      commission: commission([
        [30000, 1],
        [40000, 1.5],
        [50000, 2],
        [60000, 2.5],
        [70000, 3],
      ]),
    }),
    makePlan({
      id: "preset_base_only",
      name: "BASE ONLY",
      description: "$18/hour with no commission. A reference point for a stability-first structure.",
      base: hourly(18),
    }),
    makePlan({
      id: "preset_team_pool",
      name: "TEAM POOL",
      description:
        "$15/hour. No individual commission. 10% of store revenue above the estimated break-even goes into a pool that is split equally.",
      team: {
        ...teamOff(),
        enabled: true,
        poolType: "revenueAboveBreakEven",
        poolRatePct: 10,
        distribution: "equal",
      },
    }),
    makePlan({
      id: "preset_choose_risk",
      name: "CHOOSE YOUR RISK",
      experimental: true,
      description:
        "EXPERIMENTAL. Each salesperson picks a track. Stability: higher hourly wage, lower commission. Performance: lower hourly wage, higher commission. Both share the same team bonus.",
      tracks: {
        enabled: true,
        stability: {
          label: "Stability Track",
          hourlyRate: 17,
          commission: commission([
            [30000, 0.5],
            [50000, 1],
            [70000, 1.5],
          ]),
        },
        performance: {
          label: "Performance Track",
          hourlyRate: 13,
          commission: commission([
            [30000, 1.5],
            [40000, 2],
            [50000, 2.5],
            [60000, 3],
            [70000, 3.5],
          ]),
        },
      },
      team: hybridTeam(),
    }),
    teamFirst50k(),
    teamFirstIndividualGrowth(),
  ];
}

export const TEAM_FIRST_50K_ID = "preset_team_first_50k";

/** Fixed policy notes; the numeric rules are generated from plan settings (see describePlanRules). */
export const TEAM_FIRST_50K_NOTES = [
  "Payroll timing (not simulated): sales count in the month they are booked, earned commission is paid after delivery, and commission is reversed for returns.",
  "Manufacturer SPIFs and protection plan pay are separate and not included here.",
];

function teamFirst50k(): CompensationPlan {
  return makePlan({
    id: TEAM_FIRST_50K_ID,
    name: "TEAM FIRST, PERSONAL COMMISSION AFTER $50K",
    description:
      "$15/hour for actual hours. A team pool of 1% of total store sales (manager's sales included) split among regular sales staff by hours worked. Personal commission only on sales above $50,000: 1% appliances, 2% furniture and mattresses. $500 milestone bonuses at $50k, $75k and $100k. The manager is paid separately.",
    managersPaidSeparately: true,
    policyNotes: TEAM_FIRST_50K_NOTES,
    commission: {
      enabled: true,
      basis: "personalExcessByDepartment",
      style: "flat",
      flatRatePct: 0,
      tiers: [],
      excessThreshold: 50000,
      departmentRatesPct: { appliances: 1, furniture: 2, mattresses: 2, protection: 0, other: 0 },
    },
    bonuses: [
      bonus("$50k milestone", 50000, 500),
      bonus("$75k milestone", 75000, 500),
      bonus("$100k milestone", 100000, 500),
    ],
    team: {
      ...teamOff(),
      enabled: true,
      poolType: "revenuePercent",
      poolRatePct: 1,
      distribution: "hours",
    },
  });
}

export const INDIVIDUAL_GROWTH_ID = "preset_team_first_individual_growth";

function teamFirstIndividualGrowth(): CompensationPlan {
  const base = teamFirst50k();
  return {
    ...base,
    id: INDIVIDUAL_GROWTH_ID,
    presetId: INDIVIDUAL_GROWTH_ID,
    name: "TEAM FIRST, INDIVIDUAL GROWTH",
    description:
      "Every salesperson has a reason to help the whole store sell, and anyone who reaches their own $50,000 monthly goal earns more on every sale above it. $15/hour; a team pool of 1% of total store sales (manager's sales included) split among regular salespeople by hours and kept by everyone; $500 milestone bonuses at $50k, $75k and $100k; 1% appliances / 2% furniture and mattresses on sales above $50,000 only. The manager is paid separately.",
    team: { ...base.team, payout: "quarterly" },
    policyNotes: [
      "Everyone keeps their team share, including after passing $50,000.",
      "The team pool is earned monthly and paid quarterly.",
      "Commission is based on booked sales and paid after delivery. Returns reverse the related commission.",
      "SPIFs and protection plan pay are separate and not included here.",
    ],
  };
}

/**
 * The "safer variation": the same plan plus a small personal commission from the first sale
 * (applied to sales up to the threshold). Built on the fly for comparison; never saved over the plan.
 */
export function firstSaleVariant(plan: CompensationPlan, ratePct: number): CompensationPlan {
  return {
    ...plan,
    id: `${plan.id}__first_sale`,
    name: `${plan.name} + ${ratePct}% from first sale`,
    locked: true,
    commission: { ...plan.commission, baseRatePct: ratePct },
  };
}

export function supportsFirstSaleVariant(plan: CompensationPlan): boolean {
  return !plan.tracks.enabled && plan.commission.enabled && plan.commission.basis === "personalExcessByDepartment";
}

/** A blank plan for the Plan Builder. */
export function blankPlan(name = "New Custom Plan"): CompensationPlan {
  return makePlan({
    id: uid("plan"),
    name,
    description: "Custom plan.",
    presetId: undefined,
    commission: commission([[0, 1]], { enabled: true, style: "flat", flatRatePct: 1 }),
  });
}

export function duplicatePlan(plan: CompensationPlan, name?: string): CompensationPlan {
  const copy: CompensationPlan = JSON.parse(JSON.stringify(plan));
  copy.id = uid("plan");
  copy.name = name ?? `${plan.name} (copy)`;
  copy.locked = false;
  copy.presetId = undefined;
  return copy;
}
