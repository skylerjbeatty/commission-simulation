// Core data model for the compensation simulator.
// All rates and margins are stored as PERCENT numbers (2 = 2%, 38 = 38%).

export const DEPARTMENTS = [
  "appliances",
  "furniture",
  "mattresses",
  "protection",
  "other",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export type DepartmentSales = Record<Department, number>;

export type Track = "stability" | "performance";

export interface Employee {
  id: string;
  name: string;
  tenureYears: number;
  /** When set, overrides the plan's hourly rate for this person. */
  hourlyWageOverride: number | null;
  hoursWorked: number;
  sales: DepartmentSales;
  /** true = personal sales equal the department total; false = use manualPersonalSales. */
  useDepartmentTotal: boolean;
  manualPersonalSales: number;
  /** Used only by plans with two compensation tracks ("Choose Your Risk"). */
  track: Track;
  /** Weight used when a team pool is split with "custom" distribution. */
  teamWeight: number;
}

export interface StoreScenario {
  storeName: string;
  /** "employees" = store revenue is the sum of salesperson sales; "manual" = entered directly. */
  storeRevenueMode: "employees" | "manual";
  storeRevenue: number;
  grossMarginPct: number;
  /** Discussion estimate only - not an accounting figure. */
  estimatedBreakEvenRevenue: number;
  customersPerDay: number;
  openDaysPerMonth: number;
  standardMonthlyHours: number;
  /** Blank (null) = fall back to the storewide gross margin. */
  departmentMargins: Record<Department, number | null>;
}

export type CommissionStyle = "flat" | "retroactive" | "marginal";

export interface CommissionTier {
  id: string;
  /** Rate applies once the measured amount is >= threshold. */
  threshold: number;
  ratePct: number;
}

export type CommissionBasis =
  | "personalRevenue"
  | "personalGP"
  | "departmentRevenue"
  | "departmentGP"
  | "storeRevenue"
  | "storeGP";

export interface CommissionRule {
  enabled: boolean;
  basis: CommissionBasis;
  style: CommissionStyle;
  flatRatePct: number;
  tiers: CommissionTier[];
}

export interface BasePay {
  type: "none" | "hourly" | "salary";
  hourlyRate: number;
  monthlySalary: number;
  /** $/hour added per completed year of tenure. 0 = no tenure adjustment. */
  tenureRaisePerYear: number;
  /** Maximum hourly rate after tenure raises; null = no cap. */
  tenureCap: number | null;
}

export type BonusTrigger =
  | "personalSales"
  | "personalGP"
  | "storeSales"
  | "storeGP"
  | "departmentSales"
  | "departmentGP";

export interface Bonus {
  id: string;
  label: string;
  trigger: BonusTrigger;
  /** Required for department triggers. */
  department?: Department;
  threshold: number;
  type: "flat" | "percent";
  /** Dollars for flat bonuses; percent of the trigger amount for percent bonuses. */
  amount: number;
}

export type TeamPoolType =
  | "fixedThreshold"
  | "revenuePercent"
  | "gpPercent"
  | "revenueAboveBreakEven"
  | "gpAboveTarget";

export type TeamDistribution = "equal" | "hours" | "sales" | "blended" | "custom";

export interface TeamThreshold {
  id: string;
  /** Store revenue needed. */
  threshold: number;
  /** Dollars per salesperson once reached. */
  amountPerPerson: number;
}

export interface TeamPlan {
  enabled: boolean;
  poolType: TeamPoolType;
  thresholds: TeamThreshold[];
  poolRatePct: number;
  gpTarget: number;
  distribution: TeamDistribution;
  /** For "blended": share of the pool split by personal sales; the rest is split equally. */
  salesWeightPct: number;
}

export interface DepartmentRule {
  method: "revenue" | "grossProfit";
  style: CommissionStyle;
  flatRatePct: number;
  tiers: CommissionTier[];
}

export interface DepartmentPlan {
  enabled: boolean;
  rules: Record<Department, DepartmentRule>;
}

export interface TrackConfig {
  label: string;
  hourlyRate: number;
  commission: CommissionRule;
}

export interface TrackPlan {
  enabled: boolean;
  stability: TrackConfig;
  performance: TrackConfig;
}

export interface CompensationPlan {
  id: string;
  name: string;
  description: string;
  /** Locked plans can be viewed and duplicated but never edited. */
  locked: boolean;
  experimental: boolean;
  /** Built-in preset id this plan came from (for "reset to default"). */
  presetId?: string;
  base: BasePay;
  commission: CommissionRule;
  departmentCommission: DepartmentPlan;
  bonuses: Bonus[];
  team: TeamPlan;
  tracks: TrackPlan;
}

export interface EmployeeResult {
  employeeId: string;
  name: string;
  personalSales: number;
  personalGP: number;
  hourlyRate: number;
  basePay: number;
  personalCommission: number;
  departmentCommission: number;
  individualBonuses: number;
  /** Team pool share plus bonuses triggered by store results. */
  teamBonus: number;
  total: number;
  /** Variable pay that depends on store (not individual) results. */
  storeLinkedPay: number;
}

export interface CompTotals {
  basePay: number;
  personalCommission: number;
  departmentCommission: number;
  individualBonuses: number;
  teamBonus: number;
  total: number;
}

export interface CalculationResult {
  planId: string;
  employees: EmployeeResult[];
  totals: CompTotals;
  storeRevenue: number;
  storeGP: number;
  headcount: number;
  compPctRevenue: number;
  compPctGP: number;
  gpAfterComp: number;
  revenuePerSalesperson: number;
  gpPerSalesperson: number;
  avgCompPerSalesperson: number;
  /** Share of total comp that is guaranteed base pay (0-100). */
  guaranteedPct: number;
  /** Share of variable comp tied to team/store results (0-100). */
  teamShareOfVariablePct: number;
}
