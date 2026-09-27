"use client";

import { useState, type ReactNode } from "react";
import { useApp } from "../AppContext";
import { Badge, Button, Card, Field, NumField, Note, Select, TextField, Toggle, Table, td, tdR, th, thR } from "../ui";
import { PlanRules, PlanSelect } from "../sim/StoreControls";
import { BonusEditor, CommissionRuleEditor, STYLE_OPTIONS, TeamEditor, TierEditor } from "../builder/Editors";
import { blankPlan, buildPresets, CURRENT_PLAN_ID, duplicatePlan } from "@/lib/presets";
import { DEPARTMENT_LABELS } from "@/lib/defaults";
import { commissionOnAmount, resolveMargin } from "@/lib/engine";
import { money, pct } from "@/lib/format";
import { DEPARTMENTS, type CompensationPlan, type Department, type DepartmentRule } from "@/lib/types";

function Section({ n, title, children, right }: { n: string; title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="border-t border-stone-200 pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-widest text-stone-600 uppercase">
          <span className="text-stone-400">{n}</span> {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function BuilderTab() {
  const { state, update, planById, updatePlan } = useApp();
  const plan = planById(state.selectedPlanId);
  const set = (fn: (p: CompensationPlan) => CompensationPlan) => updatePlan(plan.id, fn);
  const preset = plan.presetId ? buildPresets().find((p) => p.id === plan.presetId) : undefined;

  const addPlan = (p: CompensationPlan) => update((s) => ({ ...s, plans: [...s.plans, p], selectedPlanId: p.id }));

  return (
    <div className="space-y-5">
      <Card
        title="Plan Builder"
        subtitle="Build a plan from scratch or adjust a preset. Changes apply immediately everywhere in the app."
        actions={
          <>
            <Button variant="primary" onClick={() => addPlan(blankPlan())}>
              + New blank plan
            </Button>
            <Button onClick={() => addPlan(duplicatePlan(plan))}>Duplicate this plan</Button>
            {preset && !plan.locked && (
              <Button
                onClick={() => {
                  if (window.confirm(`Reset ${plan.name} to its original preset values?`)) set(() => ({ ...preset }));
                }}
              >
                Reset to preset
              </Button>
            )}
            {!plan.presetId && !plan.locked && (
              <Button
                variant="danger"
                onClick={() => {
                  if (!window.confirm(`Delete plan "${plan.name}"?`)) return;
                  update((s) => {
                    const plans = s.plans.filter((p) => p.id !== plan.id);
                    const fallback = plans[1]?.id ?? CURRENT_PLAN_ID;
                    return {
                      ...s,
                      plans,
                      selectedPlanId: fallback,
                      annualPlanId: s.annualPlanId === plan.id ? fallback : s.annualPlanId,
                      comparePlanIds: s.comparePlanIds.filter((id) => id !== plan.id),
                    };
                  });
                }}
              >
                Delete plan
              </Button>
            )}
          </>
        }
      >
        <Field label="Plan being edited" className="max-w-xl">
          <PlanSelect value={state.selectedPlanId} onChange={(id) => update((s) => ({ ...s, selectedPlanId: id }))} className="w-full py-2 text-base font-semibold" />
        </Field>
        {plan.locked && (
          <div className="mt-3">
            <Note>
              <strong>CURRENT GUION&apos;S PLAN is locked</strong> so it always reflects today&apos;s structure. Use <em>Duplicate this plan</em> to
              create an editable copy.
            </Note>
          </div>
        )}
      </Card>

      <Card>
        <fieldset disabled={plan.locked} className="min-w-0 space-y-5 disabled:opacity-80">
          <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
            <Field label="Plan name">
              <TextField value={plan.name} onChange={(name) => set((p) => ({ ...p, name }))} className="w-full font-semibold" />
            </Field>
            <Field label="Description">
              <TextField value={plan.description} onChange={(description) => set((p) => ({ ...p, description }))} className="w-full" />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            {plan.locked && <Badge tone="dark">Locked</Badge>}
            {plan.experimental && <Badge>Experimental</Badge>}
          </div>

          <PlanRules plan={plan} />

          <Section
            n="0"
            title="Who this plan pays"
            right={
              <Toggle
                checked={!!plan.managersPaidSeparately}
                onChange={(v) => set((p) => ({ ...p, managersPaidSeparately: v }))}
                label="Manager paid separately"
              />
            }
          >
            <p className="text-sm text-stone-600">
              {plan.managersPaidSeparately
                ? "Salespeople marked as manager are not paid by this plan and don't share the team pool. Their sales still count toward store sales and the pool."
                : "Everyone on the sales team, including anyone marked as manager, is paid by this plan."}{" "}
              Mark managers in the Sales Team table on the Simulator.
            </p>
          </Section>

          <Section n="1" title="Base Pay">
            <BaseEditor plan={plan} set={set} />
          </Section>

          <Section
            n="2–3"
            title="Individual Commission"
            right={<Toggle checked={plan.commission.enabled} onChange={(enabled) => set((p) => ({ ...p, commission: { ...p.commission, enabled } }))} label="On" />}
          >
            {plan.tracks.enabled ? (
              <Note>This plan uses two tracks, so commission is set per track below.</Note>
            ) : plan.commission.enabled ? (
              <CommissionRuleEditor rule={plan.commission} onChange={(commission) => set((p) => ({ ...p, commission }))} />
            ) : (
              <p className="text-sm text-stone-500">No individual commission.</p>
            )}
          </Section>

          <Section n="4" title="Performance Bonuses">
            <BonusEditor bonuses={plan.bonuses} onChange={(bonuses) => set((p) => ({ ...p, bonuses }))} />
          </Section>

          <Section
            n="5"
            title="Team Compensation"
            right={<Toggle checked={plan.team.enabled} onChange={(enabled) => set((p) => ({ ...p, team: { ...p.team, enabled } }))} label="On" />}
          >
            {plan.team.enabled ? (
              <TeamEditor team={plan.team} onChange={(team) => set((p) => ({ ...p, team }))} breakEven={state.scenario.estimatedBreakEvenRevenue} />
            ) : (
              <p className="text-sm text-stone-500">Team compensation is off.</p>
            )}
          </Section>

          <Section
            n="6"
            title="Department Compensation"
            right={
              <Toggle
                checked={plan.departmentCommission.enabled}
                onChange={(enabled) => set((p) => ({ ...p, departmentCommission: { ...p.departmentCommission, enabled } }))}
                label="On"
              />
            }
          >
            <DepartmentEditor plan={plan} set={set} />
          </Section>

          <Section
            n="7"
            title="Two Tracks — Choose Your Risk (experimental)"
            right={<Toggle checked={plan.tracks.enabled} onChange={(enabled) => set((p) => ({ ...p, tracks: { ...p.tracks, enabled } }))} label="On" />}
          >
            {plan.tracks.enabled ? (
              <div className="grid gap-5 xl:grid-cols-2">
                {(["stability", "performance"] as const).map((t) => (
                  <div key={t} className="rounded-lg border border-stone-200 p-4">
                    <div className="flex flex-wrap gap-3">
                      <Field label="Track name">
                        <TextField
                          value={plan.tracks[t].label}
                          onChange={(label) => set((p) => ({ ...p, tracks: { ...p.tracks, [t]: { ...p.tracks[t], label } } }))}
                        />
                      </Field>
                      <Field label="Hourly wage">
                        <NumField
                          className="w-28"
                          prefix="$"
                          min={0}
                          value={plan.tracks[t].hourlyRate}
                          onChange={(v) => set((p) => ({ ...p, tracks: { ...p.tracks, [t]: { ...p.tracks[t], hourlyRate: v ?? 0 } } }))}
                        />
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Toggle
                        checked={plan.tracks[t].commission.enabled}
                        onChange={(enabled) =>
                          set((p) => ({ ...p, tracks: { ...p.tracks, [t]: { ...p.tracks[t], commission: { ...p.tracks[t].commission, enabled } } } }))
                        }
                        label="Commission on"
                      />
                    </div>
                    {plan.tracks[t].commission.enabled && (
                      <div className="mt-3">
                        <CommissionRuleEditor
                          rule={plan.tracks[t].commission}
                          onChange={(commission) => set((p) => ({ ...p, tracks: { ...p.tracks, [t]: { ...p.tracks[t], commission } } }))}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <p className="text-xs text-stone-500 xl:col-span-2">
                  Each salesperson&apos;s track is chosen in the Sales Team table on the Simulator. Both tracks share the bonuses and team compensation above.
                  Track wages replace the Base Pay section; hourly wage overrides still apply.
                </p>
              </div>
            ) : (
              <p className="text-sm text-stone-500">Off. Turn on to give salespeople a choice between a stability track and a performance track.</p>
            )}
          </Section>
        </fieldset>
      </Card>

      <DealCalculator plan={plan} />
    </div>
  );
}

function BaseEditor({ plan, set }: { plan: CompensationPlan; set: (fn: (p: CompensationPlan) => CompensationPlan) => void }) {
  const b = plan.base;
  const setB = (patch: Partial<typeof b>) => set((p) => ({ ...p, base: { ...p.base, ...patch } }));
  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Base type">
        <Select
          value={b.type}
          onChange={(type) => setB({ type })}
          options={[
            { value: "none", label: "No base" },
            { value: "hourly", label: "Hourly" },
            { value: "salary", label: "Salary (monthly)" },
          ]}
        />
      </Field>
      {b.type === "hourly" && (
        <>
          <Field label="Hourly rate">
            <NumField className="w-28" prefix="$" min={0} value={b.hourlyRate} onChange={(v) => setB({ hourlyRate: v ?? 0 })} />
          </Field>
          <Field label="Tenure raise (per completed year)" hint="$0 = no tenure adjustment">
            <NumField className="w-28" prefix="$" suffix="/hr" min={0} value={b.tenureRaisePerYear} onChange={(v) => setB({ tenureRaisePerYear: v ?? 0 })} />
          </Field>
          <Field label="Tenure cap (max hourly)" hint="Blank = no cap">
            <NumField className="w-28" prefix="$" allowEmpty placeholder="none" min={0} value={b.tenureCap} onChange={(v) => setB({ tenureCap: v })} />
          </Field>
        </>
      )}
      {b.type === "salary" && (
        <Field label="Monthly salary">
          <NumField className="w-36" prefix="$" decimals={0} min={0} value={b.monthlySalary} onChange={(v) => setB({ monthlySalary: v ?? 0 })} />
        </Field>
      )}
    </div>
  );
}

function DepartmentEditor({ plan, set }: { plan: CompensationPlan; set: (fn: (p: CompensationPlan) => CompensationPlan) => void }) {
  const { state, update } = useApp();
  const [expanded, setExpanded] = useState<Department | null>(null);
  const dp = plan.departmentCommission;
  const setRule = (d: Department, patch: Partial<DepartmentRule>) =>
    set((p) => ({
      ...p,
      departmentCommission: { ...p.departmentCommission, rules: { ...p.departmentCommission.rules, [d]: { ...p.departmentCommission.rules[d], ...patch } } },
    }));
  const setMargin = (d: Department, v: number | null) =>
    update((s) => ({ ...s, scenario: { ...s.scenario, departmentMargins: { ...s.scenario.departmentMargins, [d]: v } } }));

  return (
    <div>
      <Table>
        <thead>
          <tr>
            <th className={th}>Department</th>
            <th className={thR}>Team revenue</th>
            <th className={thR} title="Blank uses the storewide gross margin">
              Gross margin
            </th>
            <th className={thR}>Gross profit</th>
            {dp.enabled && (
              <>
                <th className={th}>Commission method</th>
                <th className={th}>Style</th>
                <th className={th}>Rate / tiers</th>
                <th className={thR}>Team commission</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {DEPARTMENTS.map((d) => {
            const revenue = state.employees.reduce((a, e) => a + (e.sales[d] || 0), 0);
            const margin = resolveMargin(state.scenario, d);
            const gp = (revenue * margin) / 100;
            const r = dp.rules[d];
            const commission = state.employees.reduce((a, e) => {
              const amt = r.method === "grossProfit" ? ((e.sales[d] || 0) * margin) / 100 : e.sales[d] || 0;
              return a + commissionOnAmount(amt, r.style, r.flatRatePct, r.tiers);
            }, 0);
            return (
              <tr key={d} className="align-top">
                <td className={`${td} font-medium`}>{DEPARTMENT_LABELS[d]}</td>
                <td className={tdR}>{money(revenue)}</td>
                <td className={tdR}>
                  <NumField
                    size="sm"
                    className="ml-auto w-24"
                    suffix="%"
                    allowEmpty
                    placeholder={`${state.scenario.grossMarginPct}`}
                    min={0}
                    max={100}
                    value={state.scenario.departmentMargins[d]}
                    onChange={(v) => setMargin(d, v)}
                    ariaLabel={`${DEPARTMENT_LABELS[d]} margin`}
                  />
                </td>
                <td className={tdR}>{money(gp)}</td>
                {dp.enabled && (
                  <>
                    <td className={td}>
                      <Select
                        value={r.method}
                        onChange={(method) => setRule(d, { method })}
                        options={[
                          { value: "revenue", label: "Revenue" },
                          { value: "grossProfit", label: "Gross profit" },
                        ]}
                      />
                    </td>
                    <td className={td}>
                      <Select value={r.style} onChange={(style) => setRule(d, { style })} options={STYLE_OPTIONS} />
                    </td>
                    <td className={td}>
                      {r.style === "flat" ? (
                        <NumField size="sm" className="w-24" suffix="%" min={0} value={r.flatRatePct} onChange={(v) => setRule(d, { flatRatePct: v ?? 0 })} ariaLabel="Department rate" />
                      ) : (
                        <Button variant="ghost" onClick={() => setExpanded(expanded === d ? null : d)}>
                          {r.tiers.length} tier{r.tiers.length === 1 ? "" : "s"} — {expanded === d ? "hide" : "edit"}
                        </Button>
                      )}
                    </td>
                    <td className={tdR}>{money(commission)}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </Table>
      {dp.enabled && expanded && dp.rules[expanded].style !== "flat" && (
        <div className="mt-3 rounded-lg border border-stone-200 p-4">
          <div className="mb-2 text-sm font-semibold">{DEPARTMENT_LABELS[expanded]} tiers (measured on each salesperson&apos;s department {dp.rules[expanded].method === "grossProfit" ? "gross profit" : "sales"})</div>
          <TierEditor tiers={dp.rules[expanded].tiers} style={dp.rules[expanded].style} onChange={(tiers) => setRule(expanded, { tiers })} />
        </div>
      )}
      <p className="mt-2 text-xs text-stone-500">
        Department margins are blank by default and fall back to the storewide {pct(state.scenario.grossMarginPct, 1)} margin. Enter real
        department margins when known; they apply to every plan. Department commission is paid in addition to any individual commission.
      </p>
    </div>
  );
}

/** Shows how discounting a single sale changes revenue commission vs. gross-profit commission. */
function DealCalculator({ plan }: { plan: CompensationPlan }) {
  const [price, setPrice] = useState(2000);
  const [cost, setCost] = useState(1240);
  const [discount, setDiscount] = useState(10);
  const [revRate, setRevRate] = useState(2);
  const [gpRate, setGpRate] = useState(6);
  const gp = price - cost;
  const margin = price > 0 ? (gp / price) * 100 : 0;
  const dPrice = price * (1 - discount / 100);
  const dGp = dPrice - cost;
  const dMargin = dPrice > 0 ? (dGp / dPrice) * 100 : 0;
  const rows = [
    { label: "Sales price", a: money(price, 2), b: money(dPrice, 2) },
    { label: "Cost", a: money(cost, 2), b: money(cost, 2) },
    { label: "Gross profit", a: money(gp, 2), b: money(dGp, 2) },
    { label: "Gross margin", a: pct(margin, 1), b: pct(dMargin, 1) },
    { label: `Revenue commission @ ${revRate}%`, a: money((price * revRate) / 100, 2), b: money((dPrice * revRate) / 100, 2) },
    { label: `Gross-profit commission @ ${gpRate}%`, a: money((Math.max(0, gp) * gpRate) / 100, 2), b: money((Math.max(0, dGp) * gpRate) / 100, 2) },
  ];
  return (
    <Card
      title="Single-Sale Calculator: Revenue vs Gross-Profit Commission"
      subtitle={`Illustrates why commission on gross profit (revenue − cost) discourages excessive discounting. Rates here are for illustration and separate from ${plan.name}.`}
    >
      <div className="flex flex-wrap gap-4">
        <Field label="Sales price">
          <NumField className="w-32" prefix="$" min={0} value={price} onChange={(v) => setPrice(v ?? 0)} />
        </Field>
        <Field label="Cost">
          <NumField className="w-32" prefix="$" min={0} value={cost} onChange={(v) => setCost(v ?? 0)} />
        </Field>
        <Field label="Discount">
          <NumField className="w-24" suffix="%" min={0} max={100} value={discount} onChange={(v) => setDiscount(v ?? 0)} />
        </Field>
        <Field label="Revenue commission rate">
          <NumField className="w-24" suffix="%" min={0} value={revRate} onChange={(v) => setRevRate(v ?? 0)} />
        </Field>
        <Field label="GP commission rate">
          <NumField className="w-24" suffix="%" min={0} value={gpRate} onChange={(v) => setGpRate(v ?? 0)} />
        </Field>
      </div>
      <div className="mt-4 max-w-2xl">
        <Table>
          <thead>
            <tr>
              <th className={th} />
              <th className={thR}>Full price</th>
              <th className={thR}>With {discount}% discount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={td}>{r.label}</td>
                <td className={tdR}>{r.a}</td>
                <td className={`${tdR} font-semibold`}>{r.b}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <p className="mt-3 text-sm text-stone-600">
        A {discount}% discount lowers the revenue commission by {discount}% but lowers gross profit — and the gross-profit commission — by{" "}
        {gp > 0 ? pct(((gp - Math.max(0, dGp)) / gp) * 100, 0) : "—"}.
      </p>
    </Card>
  );
}
