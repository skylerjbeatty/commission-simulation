import { DEPARTMENT_LABELS } from "./defaults";
import { money, pct } from "./format";
import { DEPARTMENTS, type CompensationPlan } from "./types";

/** Plain-language rules derived from a plan's current settings, followed by its fixed policy notes. */
export function describePlanRules(plan: CompensationPlan): string[] {
  const out: string[] = [];
  const rule = plan.commission;
  if (!plan.tracks.enabled && rule.enabled && rule.basis === "personalExcessByDepartment") {
    const t = rule.excessThreshold ?? 0;
    const rates = rule.departmentRatesPct;
    const paid = DEPARTMENTS.filter((d) => (rates?.[d] ?? 0) > 0).map((d) => `${pct(rates![d], 2)} on ${DEPARTMENT_LABELS[d].toLowerCase()}`);
    const bonusAtT = plan.bonuses.filter((b) => b.trigger === "personalSales" && b.threshold === t && b.type === "flat").reduce((a, b) => a + b.amount, 0);
    out.push(
      `At exactly ${money(t)} in personal sales, the salesperson ${bonusAtT > 0 ? `earns the ${money(bonusAtT)} milestone bonus but ` : "earns "}no personal commission yet. Personal commission starts with the next dollar sold.`,
    );
    out.push(
      `Personal commission is paid only on sales above ${money(t)}${paid.length ? `: ${paid.join(", ")}` : ""}. It is never applied back to the first ${money(t)}.`,
    );
  }
  const milestones = plan.bonuses.filter((b) => b.trigger === "personalSales" && b.type === "flat").sort((a, b) => a.threshold - b.threshold);
  if (milestones.length > 1) {
    const total = milestones.reduce((a, b) => a + b.amount, 0);
    out.push(
      `Milestone bonuses stack: ${milestones.map((b, i) => `${i === 0 ? "" : "another "}${money(b.amount)} at ${money(b.threshold)}`).join(", ")} (up to ${money(total)}).`,
    );
  }
  if (plan.team.enabled && plan.team.poolType === "revenuePercent") {
    const split = { equal: "equally", hours: "in proportion to hours worked", sales: "by personal sales", blended: "partly equally and partly by sales", custom: "by custom weights" }[plan.team.distribution];
    out.push(
      `The team pool is ${pct(plan.team.poolRatePct, 2)} of total store sales${plan.managersPaidSeparately ? ", including the manager's sales. It is split only among regular sales staff" : ", split"} ${split}.`,
    );
  }
  if (plan.managersPaidSeparately) out.push("The manager is paid under a separate plan and is not paid by this plan.");
  return [...out, ...(plan.policyNotes ?? [])];
}
