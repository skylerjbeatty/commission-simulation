"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useApp } from "../AppContext";
import { Button, Card, Segmented, Slider, Toggle } from "../ui";
import { CURRENT_COLOR, LineChart, SERIES_COLORS, type Series } from "../LineChart";
import { STYLE_HELP } from "../builder/Editors";
import { earningsCurve, referencePay, tracksFor, type ReferenceOptions } from "@/lib/analysis";
import { changeLabel, kMoney, money } from "@/lib/format";
import { duplicatePlan, uid } from "@/lib/presets";
import { DEPARTMENTS, type CommissionRule, type CommissionStyle, type CompensationPlan, type StoreScenario, type Track } from "@/lib/types";
import { DEPARTMENT_LABELS } from "@/lib/defaults";

const pctFmt = (v: number) => `${v.toFixed(2).replace(/\.?0+$/, "")}%`;
const dollars = (v: number) => money(v);
const hourly = (v: number) => `${money(v, 2)}/hr`;

function Group({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="space-y-3 border-t border-stone-200 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-widest text-stone-500 uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

/**
 * The earnings curve with the most important plan levers right beside it.
 * Sliders edit the selected plan directly, so every other section updates too.
 */
export default function EarningsWorkbench({
  plan,
  current,
  extraPlans,
  scenario,
  opts,
  extraControls,
}: {
  plan: CompensationPlan;
  current: CompensationPlan;
  extraPlans: CompensationPlan[];
  scenario: StoreScenario;
  opts: ReferenceOptions;
  extraControls?: ReactNode;
}) {
  const { state, update, updatePlan } = useApp();
  const [checkSales, setCheckSales] = useState(50000);
  const [hours, setHours] = useState<number | null>(null);
  const [teamRevenue, setTeamRevenue] = useState<number | null>(null);
  const [editTrack, setEditTrack] = useState<Track>("stability");

  const curveOpts = useMemo<ReferenceOptions>(
    () => ({
      ...opts,
      hours: hours ?? scenario.standardMonthlyHours,
      storeRevenue: teamRevenue ?? opts.storeRevenue,
    }),
    [opts, hours, teamRevenue, scenario.standardMonthlyHours],
  );

  const plans = useMemo(() => [plan, ...extraPlans.filter((p) => p.id !== plan.id)].filter((p) => p.id !== current.id), [plan, extraPlans, current.id]);

  const series = useMemo<Series[]>(() => {
    const out: Series[] = [
      { id: current.id, name: "Current plan", color: CURRENT_COLOR, dashed: true, points: earningsCurve(current, scenario, curveOpts) },
    ];
    let slot = 0;
    for (const p of plans) {
      for (const t of tracksFor(p)) {
        out.push({
          id: `${p.id}-${t}`,
          name: p.tracks.enabled ? `${p.name} · ${p.tracks[t].label}` : p.name,
          color: SERIES_COLORS[slot % SERIES_COLORS.length],
          points: earningsCurve(p, scenario, { ...curveOpts, track: t }),
        });
        slot++;
      }
    }
    return out;
  }, [current, plans, scenario, curveOpts]);

  // Readout at the chosen sales level.
  const readout = useMemo(() => {
    const cur = referencePay(current, scenario, checkSales, { ...curveOpts, track: "stability" });
    const rows = plans.flatMap((p) =>
      tracksFor(p).map((t) => ({
        name: p.tracks.enabled ? `${p.name} · ${p.tracks[t].label}` : p.name,
        pay: referencePay(p, scenario, checkSales, { ...curveOpts, track: t }),
      })),
    );
    return { cur, rows };
  }, [current, plans, scenario, checkSales, curveOpts]);

  const locked = plan.locked;
  const set = (fn: (p: CompensationPlan) => CompensationPlan) => updatePlan(plan.id, fn);

  // Which commission rule the sliders edit (per track for two-track plans).
  const rule: CommissionRule = plan.tracks.enabled ? plan.tracks[editTrack].commission : plan.commission;
  const setRule = (fn: (r: CommissionRule) => CommissionRule) =>
    set((p) =>
      p.tracks.enabled
        ? { ...p, tracks: { ...p.tracks, [editTrack]: { ...p.tracks[editTrack], commission: fn(p.tracks[editTrack].commission) } } }
        : { ...p, commission: fn(p.commission) },
    );
  const personalBonuses = plan.bonuses.map((b, i) => ({ b, i })).filter(({ b }) => b.trigger === "personalSales");
  const team = plan.team;
  const poolMax = team.poolType === "revenueAboveBreakEven" || team.poolType === "gpAboveTarget" ? 25 : 5;

  const makeEditableCopy = () => {
    const copy = duplicatePlan(plan, `${plan.name} (copy)`);
    update((s) => ({ ...s, plans: [...s.plans, copy], selectedPlanId: copy.id }));
  };

  return (
    <Card
      title="Employee Earnings Curve"
      subtitle="Monthly pay for one salesperson from $0 to $120,000 in personal sales. Vertical steps are commission cliffs. Drag the sliders to reshape the selected plan — every section of the simulator updates."
      actions={extraControls}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="mb-4 rounded-lg bg-stone-50 p-3">
            <Slider label="Check a sales level" value={checkSales} onChange={setCheckSales} min={0} max={120000} step={1000} format={dollars} />
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span>
                <span className="text-stone-500">Current plan: </span>
                <span className="font-semibold tabular-nums">{money(readout.cur.total)}</span>
              </span>
              {readout.rows.map((r) => (
                <span key={r.name}>
                  <span className="text-stone-500">{r.name}: </span>
                  <span className="font-semibold tabular-nums">{money(r.pay.total)}</span>{" "}
                  <span className="text-stone-500 tabular-nums">({changeLabel(r.pay.total - readout.cur.total)} vs current)</span>
                </span>
              ))}
            </div>
          </div>
          <LineChart
            series={series}
            xFormat={kMoney}
            yFormat={(v) => money(v)}
            xLabel="Personal monthly sales"
            yLabel="Monthly compensation"
            markerX={checkSales}
          />
        </div>

        <div className="space-y-4 rounded-lg border border-stone-200 p-4 xl:max-h-[760px] xl:overflow-y-auto">
          <div>
            <div className="text-xs text-stone-500">Sliders edit</div>
            <div className="font-semibold">{plan.name}</div>
            {locked && (
              <div className="mt-2 space-y-2 text-sm text-stone-600">
                <p>The current plan is locked. Make a copy to experiment with it.</p>
                <Button variant="primary" onClick={makeEditableCopy}>
                  Make an editable copy
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Group title="Salesperson">
              <Slider
                label="Tenure (years)"
                value={state.referenceTenure}
                onChange={(v) => update((s) => ({ ...s, referenceTenure: v }))}
                min={0}
                max={15}
                step={1}
                format={(v) => `${v} yr${v === 1 ? "" : "s"}`}
              />
              <Slider
                label="Hours worked (month)"
                value={hours ?? scenario.standardMonthlyHours}
                onChange={setHours}
                min={80}
                max={220}
                step={1}
                format={(v) => `${v} hrs`}
              />
            </Group>
          </div>

          <fieldset disabled={locked} className="min-w-0 space-y-4 border-t border-stone-200 pt-3 disabled:opacity-50">

            <Group title="Base pay">
              {plan.tracks.enabled ? (
                (["stability", "performance"] as const).map((t) => (
                  <Slider
                    key={t}
                    label={`${plan.tracks[t].label} hourly`}
                    value={plan.tracks[t].hourlyRate}
                    onChange={(v) => set((p) => ({ ...p, tracks: { ...p.tracks, [t]: { ...p.tracks[t], hourlyRate: v } } }))}
                    min={8}
                    max={30}
                    step={0.25}
                    format={hourly}
                  />
                ))
              ) : plan.base.type === "hourly" ? (
                <>
                  <Slider
                    label="Hourly rate"
                    value={plan.base.hourlyRate}
                    onChange={(v) => set((p) => ({ ...p, base: { ...p.base, hourlyRate: v } }))}
                    min={8}
                    max={30}
                    step={0.25}
                    format={hourly}
                  />
                  {plan.base.tenureRaisePerYear > 0 && (
                    <Slider
                      label="Raise per year of tenure"
                      value={plan.base.tenureRaisePerYear}
                      onChange={(v) => set((p) => ({ ...p, base: { ...p.base, tenureRaisePerYear: v } }))}
                      min={0}
                      max={3}
                      step={0.25}
                      format={hourly}
                    />
                  )}
                </>
              ) : plan.base.type === "salary" ? (
                <Slider
                  label="Monthly salary"
                  value={plan.base.monthlySalary}
                  onChange={(v) => set((p) => ({ ...p, base: { ...p.base, monthlySalary: v } }))}
                  min={0}
                  max={6000}
                  step={50}
                  format={dollars}
                />
              ) : (
                <p className="text-sm text-stone-500">No base pay.</p>
              )}
            </Group>

            <Group
              title="Commission"
              right={
                !plan.tracks.enabled && (
                  <Toggle checked={plan.commission.enabled} onChange={(enabled) => set((p) => ({ ...p, commission: { ...p.commission, enabled } }))} label="On" />
                )
              }
            >
              {plan.tracks.enabled && (
                <Segmented<Track>
                  value={editTrack}
                  onChange={setEditTrack}
                  options={[
                    { value: "stability", label: plan.tracks.stability.label },
                    { value: "performance", label: plan.tracks.performance.label },
                  ]}
                />
              )}
              {rule.enabled && rule.basis === "personalExcessByDepartment" ? (
                <div className="space-y-3">
                  <Slider
                    label="No commission on the first"
                    value={rule.excessThreshold ?? 0}
                    onChange={(v) => setRule((r) => ({ ...r, excessThreshold: v }))}
                    min={0}
                    max={120000}
                    step={1000}
                    format={dollars}
                  />
                  {DEPARTMENTS.map((d) => {
                    const rates = rule.departmentRatesPct ?? { appliances: 0, furniture: 0, mattresses: 0, protection: 0, other: 0 };
                    return (
                      <Slider
                        key={d}
                        label={`${DEPARTMENT_LABELS[d]} rate (above threshold)`}
                        value={rates[d]}
                        onChange={(v) => setRule((r) => ({ ...r, departmentRatesPct: { ...rates, [d]: v } }))}
                        min={0}
                        max={6}
                        step={0.1}
                        format={pctFmt}
                      />
                    );
                  })}
                  <p className="text-xs text-stone-500">
                    Paid only on sales above {money(rule.excessThreshold ?? 0)}, never on the first {money(rule.excessThreshold ?? 0)}. At exactly{" "}
                    {money(rule.excessThreshold ?? 0)} no personal commission is earned yet; it starts with the next dollar.
                  </p>
                </div>
              ) : null}
              {rule.enabled && rule.basis === "personalExcessByDepartment" ? null : rule.enabled ? (
                <>
                  <div>
                    <Segmented<CommissionStyle>
                      value={rule.style}
                      onChange={(style) => setRule((r) => ({ ...r, style }))}
                      options={[
                        { value: "retroactive", label: "Retroactive" },
                        { value: "marginal", label: "Marginal" },
                        { value: "flat", label: "Flat" },
                      ]}
                    />
                    <details className="mt-1 text-xs text-stone-500">
                      <summary className="cursor-pointer select-none">What&apos;s the difference?</summary>
                      <div className="mt-1 leading-relaxed">{STYLE_HELP}</div>
                    </details>
                  </div>
                  {rule.basis !== "personalRevenue" && (
                    <p className="text-xs text-stone-500">Measured on {rule.basis.replace(/([A-Z])/g, " $1").toLowerCase()} — thresholds below are in those dollars.</p>
                  )}
                  {rule.style === "flat" ? (
                    <Slider
                      label="Flat rate"
                      value={rule.flatRatePct}
                      onChange={(v) => setRule((r) => ({ ...r, flatRatePct: v }))}
                      min={0}
                      max={8}
                      step={0.1}
                      format={pctFmt}
                    />
                  ) : (
                    <div className="space-y-3">
                      {rule.tiers.map((t, i) => (
                        <div key={t.id} className="rounded-md bg-stone-50 p-2">
                          <div className="mb-1 flex items-center justify-between text-xs font-medium text-stone-600">
                            <span>Tier {i + 1}</span>
                            <button
                              className="text-stone-400 hover:text-red-700"
                              onClick={() => setRule((r) => ({ ...r, tiers: r.tiers.filter((x) => x.id !== t.id) }))}
                              aria-label={`Delete tier ${i + 1}`}
                            >
                              Remove
                            </button>
                          </div>
                          <div className="space-y-2">
                            <Slider
                              label="Starts at"
                              value={t.threshold}
                              onChange={(v) => setRule((r) => ({ ...r, tiers: r.tiers.map((x) => (x.id === t.id ? { ...x, threshold: v } : x)) }))}
                              min={0}
                              max={rule.basis.includes("GP") ? 50000 : 120000}
                              step={1000}
                              format={dollars}
                            />
                            <Slider
                              label="Rate"
                              value={t.ratePct}
                              onChange={(v) => setRule((r) => ({ ...r, tiers: r.tiers.map((x) => (x.id === t.id ? { ...x, ratePct: v } : x)) }))}
                              min={0}
                              max={rule.basis.includes("GP") ? 15 : 6}
                              step={0.1}
                              format={pctFmt}
                            />
                          </div>
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          setRule((r) => {
                            const last = [...r.tiers].sort((a, b) => a.threshold - b.threshold).pop();
                            return {
                              ...r,
                              tiers: [...r.tiers, { id: uid("tier"), threshold: last ? last.threshold + 10000 : 30000, ratePct: last ? last.ratePct + 0.5 : 1 }],
                            };
                          })
                        }
                      >
                        + Add tier
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-stone-500">No individual commission.</p>
              )}
            </Group>

            <Group title="Performance bonuses">
              {personalBonuses.length === 0 && <p className="text-sm text-stone-500">No personal-sales bonuses.</p>}
              {personalBonuses.map(({ b, i }) => (
                <div key={b.id} className="rounded-md bg-stone-50 p-2">
                  <div className="mb-1 flex items-center justify-between text-xs font-medium text-stone-600">
                    <span>{b.label}</span>
                    <button
                      className="text-stone-400 hover:text-red-700"
                      onClick={() => set((p) => ({ ...p, bonuses: p.bonuses.filter((_, j) => j !== i) }))}
                      aria-label={`Delete ${b.label}`}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Slider
                      label="At personal sales of"
                      value={b.threshold}
                      onChange={(v) => set((p) => ({ ...p, bonuses: p.bonuses.map((x, j) => (j === i ? { ...x, threshold: v } : x)) }))}
                      min={0}
                      max={150000}
                      step={1000}
                      format={dollars}
                    />
                    <Slider
                      label={b.type === "flat" ? "Bonus" : "Bonus (% of sales)"}
                      value={b.amount}
                      onChange={(v) => set((p) => ({ ...p, bonuses: p.bonuses.map((x, j) => (j === i ? { ...x, amount: v } : x)) }))}
                      min={0}
                      max={b.type === "flat" ? 2000 : 3}
                      step={b.type === "flat" ? 25 : 0.1}
                      format={b.type === "flat" ? dollars : pctFmt}
                    />
                  </div>
                </div>
              ))}
              <Button
                onClick={() => {
                  const last = personalBonuses[personalBonuses.length - 1]?.b;
                  const threshold = last ? last.threshold + 20000 : 80000;
                  set((p) => ({
                    ...p,
                    bonuses: [...p.bonuses, { id: uid("bonus"), label: `${kMoney(threshold)} personal sales`, trigger: "personalSales", threshold, type: "flat", amount: 500 }],
                  }));
                }}
              >
                + Add bonus
              </Button>
            </Group>

            <Group
              title="Team bonus"
              right={<Toggle checked={team.enabled} onChange={(enabled) => set((p) => ({ ...p, team: { ...p.team, enabled } }))} label="On" />}
            >
              {team.enabled ? (
                team.poolType === "fixedThreshold" ? (
                  team.thresholds.map((t, i) => (
                    <Slider
                      key={t.id}
                      label={`Per person at ${kMoney(t.threshold)} store revenue`}
                      value={t.amountPerPerson}
                      onChange={(v) => set((p) => ({ ...p, team: { ...p.team, thresholds: p.team.thresholds.map((x, j) => (j === i ? { ...x, amountPerPerson: v } : x)) } }))}
                      min={0}
                      max={1500}
                      step={25}
                      format={dollars}
                    />
                  ))
                ) : (
                  <Slider
                    label="Pool rate"
                    value={team.poolRatePct}
                    onChange={(v) => set((p) => ({ ...p, team: { ...p.team, poolRatePct: v } }))}
                    min={0}
                    max={poolMax}
                    step={0.1}
                    format={pctFmt}
                  />
                )
              ) : (
                <p className="text-sm text-stone-500">Team bonus is off.</p>
              )}
            </Group>
          </fieldset>

          <Group
            title="Store month (chart only)"
            right={
              teamRevenue !== null && (
                <button className="text-xs text-stone-500 underline" onClick={() => setTeamRevenue(null)}>
                  Reset
                </button>
              )
            }
          >
            <Slider
              label="Store revenue used for team pay"
              value={teamRevenue ?? opts.storeRevenue ?? 0}
              onChange={setTeamRevenue}
              min={150000}
              max={350000}
              step={5000}
              format={dollars}
            />
            <p className="text-xs text-stone-500">
              Moves the curve for team bonuses only. Change the real store month in Scenario Testing above.
            </p>
          </Group>

          {plan.departmentCommission.enabled && (
            <p className="text-xs text-stone-500">Department commission rates are edited in the Plan Builder.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
