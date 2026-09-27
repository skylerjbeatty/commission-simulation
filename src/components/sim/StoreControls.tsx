"use client";

import { useApp } from "../AppContext";
import { Badge, Button, Field, NumField, Select } from "../ui";
import { applyStoreRevenue, currentStoreRevenue, setHeadcount } from "@/lib/actions";
import { MAX_SALESPEOPLE, MIN_SALESPEOPLE } from "@/lib/defaults";
import { money } from "@/lib/format";
import { personalSales } from "@/lib/engine";
import type { CompensationPlan } from "@/lib/types";
import { describePlanRules } from "@/lib/planRules";

export function PlanSelect({
  value,
  onChange,
  includeCurrent = true,
  className = "",
}: {
  value: string;
  onChange: (id: string) => void;
  includeCurrent?: boolean;
  className?: string;
}) {
  const { state } = useApp();
  return (
    <Select
      ariaLabel="Plan"
      className={className}
      value={value}
      onChange={onChange}
      options={state.plans
        .filter((p) => includeCurrent || !p.locked)
        .map((p) => ({ value: p.id, label: `${p.name}${p.locked ? " (locked)" : ""}${p.experimental ? " — experimental" : ""}` }))}
    />
  );
}

/** Plain-language plan rules (thresholds, exclusions, payroll timing). */
export function PlanRules({ plan }: { plan: CompensationPlan }) {
  const notes = describePlanRules(plan);
  if (!plan.policyNotes?.length && !plan.managersPaidSeparately && plan.commission.basis !== "personalExcessByDepartment") return null;
  return (
    <details className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm" open>
      <summary className="cursor-pointer font-semibold text-stone-800 select-none">How this plan works</summary>
      <ul className="mt-2 space-y-1.5 text-stone-700">
        {notes.map((n, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-400" />
            <span>{n}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function StoreControls({ onEditPlan }: { onEditPlan: () => void }) {
  const { state, update, planById } = useApp();
  const plan = planById(state.selectedPlanId);
  const revenue = currentStoreRevenue(state);
  const sc = state.scenario;
  const setScenario = (patch: Partial<typeof sc>) => update((s) => ({ ...s, scenario: { ...s.scenario, ...patch } }));
  const n = state.employees.length;
  const managers = state.employees.filter((e) => e.isManager).length;

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Selected Plan" className="min-w-0 flex-1">
          <div className="flex gap-2">
            <PlanSelect
              value={state.selectedPlanId}
              onChange={(id) => update((s) => ({ ...s, selectedPlanId: id }))}
              className="min-w-0 flex-1 py-2 text-base font-semibold"
            />
            <Button onClick={onEditPlan}>{plan.locked ? "View" : "Edit"}</Button>
          </div>
        </Field>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        {plan.experimental && <Badge>Experimental</Badge>} {plan.description}
      </p>
      <PlanRules plan={plan} />

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Field
          label="Store Revenue (month)"
          hint={sc.storeRevenueMode === "employees" ? "Split across salespeople" : "Entered separately from salesperson sales"}
          className="col-span-2 md:col-span-1"
        >
          <NumField value={revenue} prefix="$" decimals={0} min={0} size="lg" onChange={(v) => update((s) => applyStoreRevenue(s, v ?? 0))} />
        </Field>
        <Field label="Gross Margin">
          <NumField value={sc.grossMarginPct} suffix="%" min={0} max={100} size="lg" onChange={(v) => setScenario({ grossMarginPct: v ?? 0 })} />
        </Field>
        <Field label="Estimated Store Break-Even Revenue" hint="Discussion estimate, not an accounting figure">
          <NumField
            value={sc.estimatedBreakEvenRevenue}
            prefix="$"
            decimals={0}
            min={0}
            size="lg"
            onChange={(v) => setScenario({ estimatedBreakEvenRevenue: v ?? 0 })}
          />
        </Field>
        <Field
          label={`Salespeople (${MIN_SALESPEOPLE}–${MAX_SALESPEOPLE})`}
          hint={`${managers > 0 ? `${n - managers} regular staff + ${managers} manager${managers > 1 ? "s" : ""} · ` : ""}${state.keepRevenueOnHeadcountChange ? "Store revenue held constant" : "New person adds average sales"}`}
        >
          <div className="flex items-center gap-2">
            <Button onClick={() => update((s) => setHeadcount(s, n - 1))} disabled={n <= MIN_SALESPEOPLE} className="px-3 text-lg">
              −
            </Button>
            <span className="w-8 text-center text-xl font-semibold tabular-nums">{n}</span>
            <Button onClick={() => update((s) => setHeadcount(s, n + 1))} disabled={n >= MAX_SALESPEOPLE} className="px-3 text-lg">
              +
            </Button>
          </div>
        </Field>
        <Field label="Customer Traffic (per day)">
          <NumField value={sc.customersPerDay} min={0} size="lg" onChange={(v) => setScenario({ customersPerDay: v ?? 0 })} />
        </Field>
        <Field label="Open Days / Month">
          <NumField value={sc.openDaysPerMonth} min={0} max={31} size="lg" onChange={(v) => setScenario({ openDaysPerMonth: v ?? 0 })} />
        </Field>
      </div>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-stone-600 select-none">More store settings</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Store revenue source">
            <Select
              value={sc.storeRevenueMode}
              onChange={(v) => setScenario({ storeRevenueMode: v, storeRevenue: revenue })}
              options={[
                { value: "employees", label: "Sum of salesperson sales" },
                { value: "manual", label: "Entered separately (house sales exist)" },
              ]}
            />
          </Field>
          {sc.storeRevenueMode === "manual" && (
            <Field label="Store revenue (manual)">
              <NumField value={sc.storeRevenue} prefix="$" decimals={0} min={0} onChange={(v) => setScenario({ storeRevenue: v ?? 0 })} />
            </Field>
          )}
          <Field label="Full-time monthly hours">
            <NumField value={sc.standardMonthlyHours} min={0} onChange={(v) => setScenario({ standardMonthlyHours: v ?? 0 })} />
          </Field>
          <Field label="Reference tenure (curves & analysis)" hint="Years, for the hypothetical salesperson">
            <NumField value={state.referenceTenure} min={0} onChange={(v) => update((s) => ({ ...s, referenceTenure: v ?? 0 }))} />
          </Field>
          <Field label="When headcount changes">
            <Select
              value={state.keepRevenueOnHeadcountChange ? "keep" : "grow"}
              onChange={(v) => update((s) => ({ ...s, keepRevenueOnHeadcountChange: v === "keep" }))}
              options={[
                { value: "keep", label: "Keep store revenue constant" },
                { value: "grow", label: "New person adds average sales" },
              ]}
            />
          </Field>
        </div>
        {sc.storeRevenueMode === "manual" && (
          <p className="mt-2 text-xs text-stone-500">
            Store revenue {money(sc.storeRevenue)} is used for team bonuses and company results. Salesperson sales total{" "}
            {money(state.employees.reduce((a, e) => a + personalSales(e), 0))}.
          </p>
        )}
      </details>
    </section>
  );
}
