"use client";

import { Button, Field, Info, NumField, Select, Table, TextField, td, tdR, th, thR } from "../ui";
import { uid } from "@/lib/presets";
import { DEPARTMENT_LABELS } from "@/lib/defaults";
import { money } from "@/lib/format";
import {
  DEPARTMENTS,
  type Bonus,
  type BonusTrigger,
  type CommissionBasis,
  type CommissionRule,
  type CommissionStyle,
  type CommissionTier,
  type Department,
  type TeamDistribution,
  type TeamPlan,
  type TeamPoolType,
} from "@/lib/types";

export const STYLE_HELP = (
  <>
    <strong>Flat:</strong> one rate on every dollar.
    <br />
    <br />
    <strong>Threshold / retroactive:</strong> once a threshold is reached, its rate applies to the ENTIRE amount. Example: $50k threshold = 2%.
    Selling $50k pays 2% × $50,000 = $1,000. This creates jumps (&ldquo;cliffs&rdquo;) at each threshold.
    <br />
    <br />
    <strong>Marginal tiered:</strong> each rate applies only to dollars inside its bracket. Example: 0–$30k = 0%, $30–40k = 1%, $40–50k = 1.5%.
    Selling $50k pays $100 + $150 = $250. No cliffs.
  </>
);

export const STYLE_OPTIONS: { value: CommissionStyle; label: string }[] = [
  { value: "flat", label: "Flat commission" },
  { value: "retroactive", label: "Threshold / retroactive" },
  { value: "marginal", label: "Marginal tiered" },
];

export const BASIS_OPTIONS: { value: CommissionBasis; label: string }[] = [
  { value: "personalRevenue", label: "Personal revenue" },
  { value: "personalExcessByDepartment", label: "Personal sales above a threshold, department rates" },
  { value: "personalGP", label: "Personal gross profit" },
  { value: "departmentRevenue", label: "Department revenue (tiers per department)" },
  { value: "departmentGP", label: "Department gross profit (tiers per department)" },
  { value: "storeRevenue", label: "Store revenue" },
  { value: "storeGP", label: "Store gross profit" },
];

export function TierEditor({
  tiers,
  onChange,
  style,
  thresholdLabel = "Threshold",
}: {
  tiers: CommissionTier[];
  onChange: (t: CommissionTier[]) => void;
  style: CommissionStyle;
  thresholdLabel?: string;
}) {
  const set = (i: number, patch: Partial<CommissionTier>) => onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tiers.length) return;
    const list = [...tiers];
    [list[i], list[j]] = [list[j], list[i]];
    onChange(list);
  };
  const sorted = tiers.every((t, i) => i === 0 || tiers[i - 1].threshold <= t.threshold);
  const add = () => {
    const last = tiers[tiers.length - 1];
    onChange([...tiers, { id: uid("tier"), threshold: last ? last.threshold + 10000 : 0, ratePct: last ? last.ratePct + 0.5 : 1 }]);
  };

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <th className={th}>{thresholdLabel}</th>
            <th className={th}>Rate</th>
            <th className={th}>{style === "marginal" ? "Applies to dollars" : "Example at threshold"}</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => {
            const next = [...tiers].sort((a, b) => a.threshold - b.threshold).find((x) => x.threshold > t.threshold);
            return (
              <tr key={t.id}>
                <td className={td}>
                  <NumField size="sm" className="w-32" prefix="$" decimals={0} min={0} value={t.threshold} onChange={(v) => set(i, { threshold: v ?? 0 })} ariaLabel="Tier threshold" />
                </td>
                <td className={td}>
                  <NumField size="sm" className="w-24" suffix="%" min={0} value={t.ratePct} onChange={(v) => set(i, { ratePct: v ?? 0 })} ariaLabel="Tier rate" />
                </td>
                <td className={`${td} text-xs text-stone-500`}>
                  {style === "marginal"
                    ? `${money(t.threshold)} – ${next ? money(next.threshold) : "and up"}`
                    : `${money(t.threshold)} × ${t.ratePct}% = ${money((t.threshold * t.ratePct) / 100)}`}
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    Move Up
                  </Button>
                  <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === tiers.length - 1}>
                    Move Down
                  </Button>
                  <Button variant="ghost" onClick={() => onChange(tiers.filter((_, j) => j !== i))}>
                    Delete
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button onClick={add}>+ Add Tier</Button>
        {!sorted && (
          <>
            <Button onClick={() => onChange([...tiers].sort((a, b) => a.threshold - b.threshold))}>Sort by threshold</Button>
            <span className="text-xs text-stone-500">Tiers are always calculated in threshold order.</span>
          </>
        )}
        {tiers.length === 0 && <span className="text-xs text-stone-500">No tiers — this pays nothing.</span>}
      </div>
    </div>
  );
}

export function CommissionRuleEditor({
  rule,
  onChange,
  showBasis = true,
}: {
  rule: CommissionRule;
  onChange: (r: CommissionRule) => void;
  showBasis?: boolean;
}) {
  const gp = rule.basis.includes("GP");
  if (rule.basis === "personalExcessByDepartment") {
    const t = rule.excessThreshold ?? 0;
    const rates = rule.departmentRatesPct ?? { appliances: 0, furniture: 0, mattresses: 0, protection: 0, other: 0 };
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          {showBasis && (
            <Field label="Commission basis">
              <Select value={rule.basis} onChange={(basis) => onChange({ ...rule, basis })} options={BASIS_OPTIONS} />
            </Field>
          )}
          <Field label="No commission on the first" hint="Personal monthly sales">
            <NumField className="w-36" prefix="$" decimals={0} min={0} value={t} onChange={(v) => onChange({ ...rule, excessThreshold: v ?? 0 })} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          {DEPARTMENTS.map((d) => (
            <Field key={d} label={`${DEPARTMENT_LABELS[d]} rate`}>
              <NumField
                className="w-24"
                suffix="%"
                min={0}
                value={rates[d]}
                onChange={(v) => onChange({ ...rule, departmentRatesPct: { ...rates, [d]: v ?? 0 } })}
              />
            </Field>
          ))}
        </div>
        <p className="rounded-md bg-stone-50 p-3 text-sm text-stone-600">
          Rates apply only to sales above {money(t)}, split across departments by each person&apos;s sales mix. They are never applied back to the first{" "}
          {money(t)}. At exactly {money(t)} a salesperson earns no personal commission yet; it starts with the next dollar sold. Example: $60,000 in
          sales pays on $10,000.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        {showBasis && (
          <Field label="Commission basis">
            <Select
              value={rule.basis}
              onChange={(basis) =>
                onChange({
                  ...rule,
                  basis,
                  ...(basis === "personalExcessByDepartment" && !rule.departmentRatesPct
                    ? { excessThreshold: 50000, departmentRatesPct: { appliances: 1, furniture: 2, mattresses: 2, protection: 0, other: 0 } }
                    : {}),
                })
              }
              options={BASIS_OPTIONS}
            />
          </Field>
        )}
        <Field
          label={
            <>
              Commission style <Info>{STYLE_HELP}</Info>
            </>
          }
        >
          <Select value={rule.style} onChange={(style) => onChange({ ...rule, style })} options={STYLE_OPTIONS} />
        </Field>
        {rule.style === "flat" && (
          <Field label="Flat rate">
            <NumField className="w-28" suffix="%" min={0} value={rule.flatRatePct} onChange={(v) => onChange({ ...rule, flatRatePct: v ?? 0 })} />
          </Field>
        )}
      </div>
      {rule.style !== "flat" && (
        <TierEditor
          tiers={rule.tiers}
          style={rule.style}
          thresholdLabel={gp ? "Gross profit threshold" : "Sales threshold"}
          onChange={(tiers) => onChange({ ...rule, tiers })}
        />
      )}
    </div>
  );
}

const TRIGGERS: { value: BonusTrigger; label: string }[] = [
  { value: "personalSales", label: "Personal sales" },
  { value: "storeSales", label: "Store sales" },
  { value: "personalGP", label: "Personal GP" },
  { value: "storeGP", label: "Store GP" },
  { value: "departmentSales", label: "Department sales" },
  { value: "departmentGP", label: "Department GP" },
];

const DEPT_OPTIONS = DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABELS[d] }));

export function BonusEditor({ bonuses, onChange }: { bonuses: Bonus[]; onChange: (b: Bonus[]) => void }) {
  const set = (i: number, patch: Partial<Bonus>) => onChange(bonuses.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div>
      {bonuses.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th className={th}>Label</th>
              <th className={th}>Trigger</th>
              <th className={th}>When at least</th>
              <th className={th}>Type</th>
              <th className={th}>Amount</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {bonuses.map((b, i) => (
              <tr key={b.id}>
                <td className={td}>
                  <TextField value={b.label} onChange={(label) => set(i, { label })} className="w-44" ariaLabel="Bonus label" />
                </td>
                <td className={td}>
                  <div className="flex gap-1">
                    <Select
                      value={b.trigger}
                      onChange={(trigger) => set(i, { trigger, department: trigger.startsWith("department") ? (b.department ?? "appliances") : undefined })}
                      options={TRIGGERS}
                    />
                    {b.trigger.startsWith("department") && (
                      <Select<Department> value={b.department ?? "appliances"} onChange={(department) => set(i, { department })} options={DEPT_OPTIONS} />
                    )}
                  </div>
                </td>
                <td className={td}>
                  <NumField size="sm" className="w-32" prefix="$" decimals={0} min={0} value={b.threshold} onChange={(v) => set(i, { threshold: v ?? 0 })} ariaLabel="Bonus threshold" />
                </td>
                <td className={td}>
                  <Select
                    value={b.type}
                    onChange={(type) => set(i, { type })}
                    options={[
                      { value: "flat", label: "Flat dollars" },
                      { value: "percent", label: "% of trigger amount" },
                    ]}
                  />
                </td>
                <td className={td}>
                  <NumField
                    size="sm"
                    className="w-28"
                    prefix={b.type === "flat" ? "$" : undefined}
                    suffix={b.type === "percent" ? "%" : undefined}
                    min={0}
                    value={b.amount}
                    onChange={(v) => set(i, { amount: v ?? 0 })}
                    ariaLabel="Bonus amount"
                  />
                </td>
                <td className={td}>
                  <Button variant="ghost" onClick={() => onChange(bonuses.filter((_, j) => j !== i))}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Button
          onClick={() =>
            onChange([...bonuses, { id: uid("bonus"), label: "New bonus", trigger: "personalSales", threshold: 80000, type: "flat", amount: 500 }])
          }
        >
          + Add Bonus
        </Button>
        <span className="text-xs text-stone-500">Bonuses stack: $80k → $500 and $100k → another $500 pays $1,000 at $100k. Store-triggered bonuses count as team pay.</span>
      </div>
    </div>
  );
}

const POOL_TYPES: { value: TeamPoolType; label: string }[] = [
  { value: "fixedThreshold", label: "Fixed bonus per person at store revenue thresholds" },
  { value: "revenuePercent", label: "Pool = % of store revenue" },
  { value: "gpPercent", label: "Pool = % of store gross profit" },
  { value: "revenueAboveBreakEven", label: "Pool = % of revenue above estimated break-even" },
  { value: "gpAboveTarget", label: "Pool = % of gross profit above a target" },
];

const DISTRIBUTIONS: { value: TeamDistribution; label: string }[] = [
  { value: "equal", label: "Equal" },
  { value: "hours", label: "By hours worked" },
  { value: "sales", label: "By personal sales" },
  { value: "blended", label: "Partly equal, partly by personal sales" },
  { value: "custom", label: "Custom weights (set in Sales Team table)" },
];

export function TeamEditor({ team, onChange, breakEven }: { team: TeamPlan; onChange: (t: TeamPlan) => void; breakEven: number }) {
  const setTh = (i: number, patch: Partial<TeamPlan["thresholds"][number]>) =>
    onChange({ ...team, thresholds: team.thresholds.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Field label="Team compensation type">
          <Select value={team.poolType} onChange={(poolType) => onChange({ ...team, poolType })} options={POOL_TYPES} />
        </Field>
        {team.poolType !== "fixedThreshold" && (
          <Field label="Pool rate">
            <NumField className="w-28" suffix="%" min={0} value={team.poolRatePct} onChange={(v) => onChange({ ...team, poolRatePct: v ?? 0 })} />
          </Field>
        )}
        {team.poolType === "gpAboveTarget" && (
          <Field label="Gross profit target">
            <NumField className="w-36" prefix="$" decimals={0} min={0} value={team.gpTarget} onChange={(v) => onChange({ ...team, gpTarget: v ?? 0 })} />
          </Field>
        )}
        <Field label="Distribution">
          <Select value={team.distribution} onChange={(distribution) => onChange({ ...team, distribution })} options={DISTRIBUTIONS} />
        </Field>
        {team.distribution === "blended" && (
          <Field label="Share split by personal sales">
            <NumField className="w-28" suffix="%" min={0} max={100} value={team.salesWeightPct} onChange={(v) => onChange({ ...team, salesWeightPct: v ?? 0 })} />
          </Field>
        )}
      </div>
      {team.poolType === "revenueAboveBreakEven" && (
        <p className="text-xs text-stone-500">Uses the Estimated Store Break-Even Revenue from the simulator ({money(breakEven)}).</p>
      )}
      {team.poolType === "fixedThreshold" && (
        <div>
          <Table>
            <thead>
              <tr>
                <th className={th}>Store revenue at least</th>
                <th className={thR}>Per salesperson</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {team.thresholds.map((t, i) => (
                <tr key={t.id}>
                  <td className={td}>
                    <NumField size="sm" className="w-36" prefix="$" decimals={0} min={0} value={t.threshold} onChange={(v) => setTh(i, { threshold: v ?? 0 })} ariaLabel="Store revenue threshold" />
                  </td>
                  <td className={tdR}>
                    <NumField size="sm" className="ml-auto w-28" prefix="$" min={0} value={t.amountPerPerson} onChange={(v) => setTh(i, { amountPerPerson: v ?? 0 })} ariaLabel="Amount per person" />
                  </td>
                  <td className={td}>
                    <Button variant="ghost" onClick={() => onChange({ ...team, thresholds: team.thresholds.filter((_, j) => j !== i) })}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-2 flex gap-2">
            <Button
              onClick={() => {
                const last = team.thresholds[team.thresholds.length - 1];
                onChange({
                  ...team,
                  thresholds: [...team.thresholds, { id: uid("tt"), threshold: last ? last.threshold + 25000 : 225000, amountPerPerson: last ? last.amountPerPerson + 100 : 100 }],
                });
              }}
            >
              + Add Threshold
            </Button>
            <Button onClick={() => onChange({ ...team, thresholds: [...team.thresholds].sort((a, b) => a.threshold - b.threshold) })}>Sort</Button>
          </div>
          <p className="mt-2 text-xs text-stone-500">The highest threshold reached pays (not cumulative). With a non-equal distribution, the pool is the per-person amount × headcount.</p>
        </div>
      )}
    </div>
  );
}
