"use client";

import { useApp } from "../AppContext";
import { Card, NumField, Toggle } from "../ui";
import { changeLabel, kMoney, money, pct } from "@/lib/format";
import { supportsFirstSaleVariant } from "@/lib/presets";
import type { CalculationResult, CompensationPlan, EmployeeResult } from "@/lib/types";

/** The four parts of pay, in the order they build up. Colors are a validated categorical set. */
const PARTS = [
  { key: "hourly", label: "Hourly pay", color: "#2a78d6" },
  { key: "team", label: "Team share", color: "#eb6834" },
  { key: "commission", label: "Personal commission", color: "#1baf7a" },
  { key: "bonus", label: "Milestone bonuses", color: "#eda100" },
] as const;

function partsOf(e: EmployeeResult): Record<(typeof PARTS)[number]["key"], number> {
  return {
    hourly: e.basePay,
    team: e.teamBonus,
    commission: e.personalCommission + e.departmentCommission,
    bonus: e.individualBonuses,
  };
}

/** Personal-sales milestones for the progress track: bonus thresholds plus the commission start. */
export function milestonesFor(plan: CompensationPlan): number[] {
  const set = new Set<number>();
  for (const b of plan.bonuses) if (b.trigger === "personalSales" && b.threshold > 0) set.add(b.threshold);
  if (plan.commission.enabled && plan.commission.basis === "personalExcessByDepartment" && (plan.commission.excessThreshold ?? 0) > 0)
    set.add(plan.commission.excessThreshold!);
  if (set.size === 0 && plan.commission.enabled && plan.commission.basis === "personalRevenue")
    for (const t of plan.commission.tiers) if (t.threshold > 0) set.add(t.threshold);
  return [...set].sort((a, b) => a - b);
}

function Progress({ sales, milestones }: { sales: number; milestones: number[] }) {
  if (!milestones.length) return null;
  const max = Math.max(milestones[milestones.length - 1] * 1.1, sales * 1.02);
  const next = milestones.find((m) => sales < m);
  return (
    <div className="mt-1.5">
      <div className="relative h-2 rounded-full bg-stone-200">
        <div className="absolute inset-y-0 left-0 rounded-full bg-stone-700" style={{ width: `${Math.min(100, (sales / max) * 100)}%` }} />
        {milestones.map((m) => (
          <div
            key={m}
            className={`absolute -top-1 h-4 w-0.5 ${sales >= m ? "bg-stone-900" : "bg-stone-400"}`}
            style={{ left: `${(m / max) * 100}%` }}
            title={`${money(m)} milestone`}
          />
        ))}
      </div>
      <div className="relative mt-0.5 h-4 text-[11px] text-stone-500">
        {milestones.map((m) => (
          <span key={m} className={`absolute -translate-x-1/2 tabular-nums ${sales >= m ? "font-semibold text-stone-800" : ""}`} style={{ left: `${(m / max) * 100}%` }}>
            {sales >= m ? "✓ " : ""}
            {kMoney(m)}
          </span>
        ))}
      </div>
      <div className="text-xs text-stone-600">
        {next ? (
          <>
            {money(sales)} sold · <span className="font-medium">{money(next - sales)} to the {kMoney(next)} milestone</span>
          </>
        ) : (
          <>{money(sales)} sold · every milestone reached</>
        )}
      </div>
    </div>
  );
}

export default function EarningsStory({
  plan,
  result,
  current,
  variant,
}: {
  plan: CompensationPlan;
  result: CalculationResult;
  current: CalculationResult;
  variant: CalculationResult | null;
}) {
  const { state, update } = useApp();
  const regular = result.employees.filter((e) => !e.paidSeparately);
  const managers = result.employees.filter((e) => e.paidSeparately);
  const maxTotal = Math.max(1, ...regular.map((e) => e.total), ...(variant ? variant.employees.filter((e) => !e.paidSeparately).map((e) => e.total) : []));
  const milestones = milestonesFor(plan);
  const t = plan.team;
  const pool = result.totals.teamBonus;
  const canVary = supportsFirstSaleVariant(plan);
  const threshold = plan.commission.excessThreshold ?? 0;
  const anyEstimate = regular.some((e) => e.commissionIsEstimate);
  const currentById = new Map(current.employees.map((e) => [e.employeeId, e]));
  const variantById = new Map((variant?.employees ?? []).map((e) => [e.employeeId, e]));

  return (
    <Card
      title="Earnings Story"
      subtitle="How each salesperson's pay builds up: hourly pay, then team share, then personal commission, then milestone bonuses."
    >
      {t.enabled && (
        <div className="mb-4 rounded-lg bg-stone-50 p-3 text-sm text-stone-700">
          <span className="font-semibold">Team pool: {money(pool)}</span>
          {t.poolType === "revenuePercent" && (
            <>
              {" "}
              = {pct(t.poolRatePct, 2)} × {money(result.storeRevenue)} store sales{managers.length ? ` (including ${managers.map((m) => m.name).join(", ")}'s sales)` : ""}
            </>
          )}
          , split among {regular.length} regular salespeople{t.distribution === "hours" ? " by hours worked" : ""}.{" "}
          {t.payout === "quarterly" ? (
            <span>
              <span className="font-medium">Earned monthly, paid quarterly</span> — at this pace about {money(pool * 3)} per quarter for the team.
            </span>
          ) : (
            "Paid monthly."
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
        {PARTS.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: p.color }} />
            {p.label}
          </span>
        ))}
      </div>

      <div className="space-y-5">
        {regular.map((e) => {
          const parts = partsOf(e);
          const cur = currentById.get(e.employeeId);
          const v = variantById.get(e.employeeId);
          return (
            <div key={e.employeeId} className="grid gap-x-4 gap-y-1 md:grid-cols-[140px_minmax(0,1fr)_150px]">
              <div>
                <div className="font-semibold">{e.name}</div>
                <div className="text-xs text-stone-500">{money(e.personalSales)} sales</div>
              </div>
              <div className="min-w-0">
                <div className="flex h-8 w-full gap-0.5" role="img" aria-label={`${e.name}: ${PARTS.map((p) => `${p.label} ${money(parts[p.key])}`).join(", ")}`}>
                  {PARTS.map((p) =>
                    parts[p.key] > 0 ? (
                      <div
                        key={p.key}
                        className="flex items-center justify-center overflow-hidden rounded-sm text-[11px] font-semibold whitespace-nowrap text-stone-900"
                        style={{ width: `${(parts[p.key] / maxTotal) * 100}%`, background: p.color }}
                        title={`${p.label}: ${money(parts[p.key])}`}
                      >
                        {parts[p.key] / maxTotal > 0.08 ? <span className="rounded bg-white/85 px-1">{money(parts[p.key])}</span> : null}
                      </div>
                    ) : null,
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-stone-600 tabular-nums">
                  {PARTS.map((p) => (
                    <span key={p.key}>
                      {p.label}: <span className="font-medium text-stone-800">{money(parts[p.key])}</span>
                    </span>
                  ))}
                  {e.commissionIsEstimate && <span className="italic">commission mix above {kMoney(threshold)} is an estimate</span>}
                  {(e.pendingDeliveryCommission ?? 0) > 0 && (
                    <span className="italic">{money(e.pendingDeliveryCommission!)} of commission pending delivery</span>
                  )}
                </div>
                <Progress sales={e.personalSales} milestones={milestones} />
              </div>
              <div className="md:text-right">
                <div className="text-2xl font-bold tabular-nums">{money(e.total)}</div>
                {cur && !plan.locked && (
                  <div className="text-xs text-stone-500">
                    Current plan {money(cur.total)} <span className="whitespace-nowrap">({changeLabel(e.total - cur.total)})</span>
                  </div>
                )}
                {v && (
                  <div className="text-xs text-stone-500">
                    With first-sale commission {money(v.total)} <span className="whitespace-nowrap">({changeLabel(v.total - e.total)})</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {managers.map((m) => (
          <div key={m.employeeId} className="grid gap-x-4 text-sm text-stone-500 md:grid-cols-[140px_minmax(0,1fr)_150px]">
            <div>
              <div className="font-semibold">{m.name}</div>
              <div className="text-xs">{money(m.personalSales)} sales</div>
            </div>
            <div className="italic">Manager — paid separately. Sales count toward store sales and the team pool.</div>
          </div>
        ))}
      </div>

      {(anyEstimate || regular.some((e) => (e.pendingDeliveryCommission ?? 0) > 0)) && (
        <p className="mt-4 text-xs text-stone-500">
          {anyEstimate &&
            `Estimate: without individual transactions, the department mix of sales above ${money(threshold)} is assumed to match each person's monthly mix. Enter transactions in the Sales Team table for exact figures. `}
          Commission is earned on booked sales and paid after delivery; returns reverse the related commission.
        </p>
      )}

      {canVary && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
          <Toggle
            checked={state.firstSaleVariant.enabled}
            onChange={(enabled) => update((s) => ({ ...s, firstSaleVariant: { ...s.firstSaleVariant, enabled } }))}
            label="Compare with a small personal commission from the first sale"
          />
          {state.firstSaleVariant.enabled && (
            <>
              <NumField
                size="sm"
                className="w-20"
                suffix="%"
                min={0}
                max={5}
                value={state.firstSaleVariant.ratePct}
                onChange={(v) => update((s) => ({ ...s, firstSaleVariant: { ...s.firstSaleVariant, ratePct: v ?? 0 } }))}
                ariaLabel="First-sale commission rate"
              />
              <span className="text-xs text-stone-500">
                on personal sales up to {money(threshold)}, then the plan&apos;s normal rates above it. This is a side-by-side comparison only — the main plan is not changed.
              </span>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
