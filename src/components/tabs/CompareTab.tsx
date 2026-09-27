"use client";

import { useMemo } from "react";
import { useApp } from "../AppContext";
import { Badge, Card, Note, Table, td, tdR, th, thR } from "../ui";
import { EarningsCurve } from "../sim/Charts";
import { planMetrics, type ReferenceOptions } from "@/lib/analysis";
import { calculatePlan, regularStaffPayroll } from "@/lib/engine";
import { storeDepartmentMix } from "@/lib/defaults";
import { changeLabel, money, pct } from "@/lib/format";
import { CURRENT_PLAN_ID } from "@/lib/presets";

export default function CompareTab() {
  const { state, update, planById } = useApp();
  const { scenario, employees } = state;
  const current = planById(CURRENT_PLAN_ID);
  const selected = useMemo(() => state.comparePlanIds.map(planById), [state.comparePlanIds, planById]);
  const toggle = (id: string) =>
    update((s) => {
      const has = s.comparePlanIds.includes(id);
      if (has) return { ...s, comparePlanIds: s.comparePlanIds.filter((x) => x !== id) };
      if (s.comparePlanIds.length >= 4) return s;
      return { ...s, comparePlanIds: [...s.comparePlanIds, id] };
    });

  const columns = useMemo(() => [current, ...selected.filter((p) => p.id !== CURRENT_PLAN_ID)], [current, selected]);
  const metrics = useMemo(() => columns.map((p) => planMetrics(p, scenario, employees)), [columns, scenario, employees]);
  const currentTotal = metrics[0].result.totals.total;
  const opts = useMemo<ReferenceOptions>(() => {
    const r = calculatePlan(current, scenario, employees);
    return { tenureYears: state.referenceTenure, mix: storeDepartmentMix(employees), headcount: employees.length,
      managerCount: employees.filter((e) => e.isManager).length, storeRevenue: r.storeRevenue };
  }, [current, scenario, employees, state.referenceTenure]);

  const managerNames = employees.filter((e) => e.isManager).map((e) => e.name);
  const showRegular = managerNames.length > 0 && columns.some((p) => p.managersPaidSeparately);
  const regularRow = showRegular
    ? [
        {
          label: "Regular sales staff payroll",
          hint: `Excludes ${managerNames.join(", ")} in every column, for a like-for-like comparison`,
          values: metrics.map((m) => money(regularStaffPayroll(m.result, employees))),
        },
      ]
    : [];
  const rows: { label: string; hint?: string; values: string[] }[] = [
    {
      label: "Total company cost (month)",
      hint: showRegular ? "Plans marked 'manager paid separately' exclude manager pay" : undefined,
      values: metrics.map((m) => money(m.result.totals.total)),
    },
    ...regularRow,
    {
      label: "Change vs current plan",
      values: metrics.map((m, i) => (i === 0 ? "—" : changeLabel(m.result.totals.total - currentTotal))),
    },
    { label: "Compensation / revenue", values: metrics.map((m) => pct(m.result.compPctRevenue, 2)) },
    { label: "Compensation / gross profit", values: metrics.map((m) => pct(m.result.compPctGP, 1)) },
    { label: "Gross profit after sales comp", values: metrics.map((m) => money(m.result.gpAfterComp)) },
    {
      label: "Individual incentive strength",
      hint: "Extra monthly pay for moving from $50k to $70k in personal sales",
      values: metrics.map((m) => `${money(m.individualIncentive)} (${pct((m.individualIncentive / 20000) * 100, 1)} of added sales)`),
    },
    {
      label: "Team incentive strength",
      hint: "Change in store-linked pay per person when store revenue goes from $225k to $275k, and share of variable pay tied to store results in this scenario",
      values: metrics.map((m) => `${money(m.teamIncentive)} · ${pct(m.teamSharePct, 0)} of variable`),
    },
    {
      label: "Income stability",
      hint: "Share of pay that is guaranteed base for a $40k producer",
      values: metrics.map((m) => `${pct(m.stabilityPct, 0)} guaranteed at $40k`),
    },
    {
      label: "Commission cliffs",
      hint: "Thresholds with a jump of $5 or more; largest single jump",
      values: metrics.map((m) => (m.cliffCount ? `${m.cliffCount} · largest ${money(m.largestCliff)}` : "None")),
    },
  ];

  return (
    <div className="space-y-5">
      <Card title="Side-by-Side Plan Comparison" subtitle="Select up to 4 plans. The current Guion's plan is always included as the reference column.">
        <div className="flex flex-wrap gap-2">
          {state.plans
            .filter((p) => !p.locked)
            .map((p) => {
              const on = state.comparePlanIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  disabled={!on && state.comparePlanIds.length >= 4}
                  className={`rounded-full border px-3 py-1 text-sm disabled:opacity-40 ${
                    on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white hover:bg-stone-50"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
        </div>
        {selected.length < 2 && (
          <div className="mt-3">
            <Note>Select at least 2 plans to compare side by side.</Note>
          </div>
        )}
      </Card>

      <Card title="Plan Characteristics" subtitle="Measured values only. No plan is labeled better or worse.">
        <Table>
          <thead>
            <tr>
              <th className={th}>Measure</th>
              {columns.map((p) => (
                <th key={p.id} className={thR}>
                  <div className="text-stone-800">{p.name}</div>
                  {p.locked && <Badge tone="outline">Reference</Badge>}
                  {p.experimental && <Badge>Experimental</Badge>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className={td}>
                  <div className="font-medium">{r.label}</div>
                  {r.hint && <div className="text-xs text-stone-500">{r.hint}</div>}
                </td>
                {r.values.map((v, i) => (
                  <td key={i} className={tdR}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title="Employee Earnings by Plan" subtitle="Monthly compensation for each salesperson in the current scenario.">
        <Table>
          <thead>
            <tr>
              <th className={th}>Employee</th>
              <th className={thR}>Sales</th>
              {columns.map((p) => (
                <th key={p.id} className={thR}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e, i) => (
              <tr key={e.id}>
                <td className={`${td} font-medium`}>{e.name}</td>
                <td className={tdR}>{money(metrics[0].result.employees[i].personalSales)}</td>
                {metrics.map((m, j) => {
                  if (m.result.employees[i].paidSeparately)
                    return (
                      <td key={j} className={`${tdR} text-xs text-stone-500 italic`}>
                        Paid separately
                      </td>
                    );
                  const v = m.result.employees[i].total;
                  const d = v - metrics[0].result.employees[i].total;
                  return (
                    <td key={j} className={tdR}>
                      <div className="font-semibold">{money(v)}</div>
                      {j > 0 && <div className="text-xs text-stone-500">{changeLabel(d)} vs current</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className={`${td} font-semibold`} colSpan={2}>
                Total
              </td>
              {metrics.map((m, j) => (
                <td key={j} className={`${tdR} text-base font-bold`}>
                  {money(m.result.totals.total)}
                </td>
              ))}
            </tr>
          </tfoot>
        </Table>
      </Card>

      <EarningsCurve current={current} plans={selected} scenario={scenario} opts={opts} />
    </div>
  );
}
