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

/** One booked sale. Entered in booking order (top = first sale of the month). */
export interface SaleTransaction {
  id: string;
  department: Department;
  amount: number;
  /** Commission is earned when booked but paid after delivery. */
  delivered: boolean;
  /** A returned sale is removed from sales and its commission is reversed. */
  returned: boolean;
}

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
  /**
   * Sales manager. Only matters for plans with `managersPaidSeparately`: the manager's sales still
   * count toward store totals, but the plan pays them nothing and they get no team pool share.
   */
  isManager?: boolean;
  /** Individual sales. When useTransactions is on, department sales are the totals of these. */
  transactions?: SaleTransaction[];
  useTransactions?: boolean;
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
  /** Nothing on the first `excessThreshold` of personal sales; department rates on the portion above it. */
  | "personalExcessByDepartment"
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
  /** personalExcessByDepartment only: personal sales at or below this earn no commission. */
  excessThreshold?: number;
  /** personalExcessByDepartment only: rate per department on the portion above the threshold. */
  departmentRatesPct?: Record<Department, number>;
  /** personalExcessByDepartment only: optional small rate on personal sales up to the threshold ("from the first sale"). */
  baseRatePct?: number;
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
  /** Display only: the pool is earned monthly; this is when it is paid out. */
  payout?: "monthly" | "quarterly";
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
  /** Managers (Employee.isManager) are excluded from this plan's pay and team pool split. */
  managersPaidSeparately?: boolean;
  /** Plain-language rules shown with the plan (thresholds, payroll timing, exclusions). */
  policyNotes?: string[];
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
  /** Manager excluded from this plan (paid separately); all pay fields are 0. */
  paidSeparately?: boolean;
  /** Above-threshold commission was estimated from monthly department totals (no transactions entered). */
  commissionIsEstimate?: boolean;
  /** Commission earned on booked sales that are not yet delivered (paid after delivery). */
  pendingDeliveryCommission?: number;
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
