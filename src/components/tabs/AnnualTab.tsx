"use client";

import { useMemo } from "react";
import { useApp } from "../AppContext";
import { Button, Card, Field, NumField, Stat, Table, td, tdR, th, thR } from "../ui";
import { PlanSelect } from "../sim/StoreControls";
import { simulateYear } from "@/lib/annual";
import { defaultAnnual } from "@/lib/defaults";
import { personalSales } from "@/lib/engine";
import { changeLabel, money, pct } from "@/lib/format";
import { CURRENT_PLAN_ID } from "@/lib/presets";

export default function AnnualTab() {
  const { state, update, planById } = useApp();
  const { scenario, employees, annual } = state;
  const plan = planById(state.annualPlanId);
  const current = planById(CURRENT_PLAN_ID);

  const cur = useMemo(() => simulateYear(current, scenario, employees, annual), [current, scenario, employees, annual]);
  const prop = useMemo(() => simulateYear(plan, scenario, employees, annual), [plan, scenario, employees, annual]);

  const setMonth = (i: number, patch: Partial<(typeof annual)[number]>) =>
    update((s) => ({ ...s, annual: s.annual.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const setSales = (i: number, id: string, v: number) =>
    update((s) => ({
      ...s,
      annual: s.annual.map((m, j) => {
        if (j !== i) return m;
        const employeeSales = { ...m.employeeSales, [id]: v };
        const sum = s.employees.reduce((a, e) => a + (employeeSales[e.id] ?? 0), 0);
        // Keep store revenue in step with salesperson sales unless it was set separately (house sales).
        const wasLinked = Math.abs(m.storeRevenue - s.employees.reduce((a, e) => a + (m.employeeSales[e.id] ?? 0), 0)) < 1;
        return { ...m, employeeSales, storeRevenue: wasLinked ? sum : m.storeRevenue };
      }),
    }));
  /** Split each month's store revenue across salespeople using current proportions. */
  const splitStoreRevenue = () =>
    update((s) => {
      const total = s.employees.reduce((a, e) => a + personalSales(e), 0) || 1;
      return {
        ...s,
        annual: s.annual.map((m) => ({
          ...m,
          employeeSales: Object.fromEntries(s.employees.map((e) => [e.id, Math.round((m.storeRevenue * personalSales(e)) / total)])),
        })),
      };
    });

  const diff = prop.totalComp - cur.totalComp;

  return (
    <div className="space-y-5">
      <Card
        title="Annual Simulation"
        subtitle="Enter each month's store revenue, margin and salesperson sales. Every month is calculated under the current plan and the selected proposed plan."
        actions={
          <>
            <Button onClick={splitStoreRevenue}>Split store revenue by current proportions</Button>
            <Button
              onClick={() => {
                if (window.confirm("Replace all 12 months with the current simulator scenario?"))
                  update((s) => ({ ...s, annual: defaultAnnual(s.employees, s.scenario.grossMarginPct) }));
              }}
            >
              Fill all months from simulator
            </Button>
          </>
        }
      >
        <Field label="Proposed plan" className="max-w-md">
          <PlanSelect value={state.annualPlanId} onChange={(id) => update((s) => ({ ...s, annualPlanId: id }))} />
        </Field>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <th className={th}>Month</th>
                <th className={thR}>Store Revenue</th>
                <th className={thR}>Gross Margin</th>
                {employees.map((e) => (
                  <th key={e.id} className={thR}>
                    {e.name}
                  </th>
                ))}
                <th className={thR}>Current plan comp</th>
                <th className={thR}>Proposed comp</th>
                <th className={thR}>Difference</th>
              </tr>
            </thead>
            <tbody>
              {annual.map((m, i) => (
                <tr key={m.month}>
                  <td className={`${td} font-medium`}>{m.month}</td>
                  <td className={tdR}>
                    <NumField size="sm" className="ml-auto w-28" prefix="$" decimals={0} min={0} value={m.storeRevenue} onChange={(v) => setMonth(i, { storeRevenue: v ?? 0 })} ariaLabel={`${m.month} store revenue`} />
                  </td>
                  <td className={tdR}>
                    <NumField size="sm" className="ml-auto w-20" suffix="%" min={0} max={100} value={m.grossMarginPct} onChange={(v) => setMonth(i, { grossMarginPct: v ?? 0 })} ariaLabel={`${m.month} gross margin`} />
                  </td>
                  {employees.map((e) => (
                    <td key={e.id} className={tdR}>
                      <NumField size="sm" className="ml-auto w-24" prefix="$" decimals={0} min={0} value={m.employeeSales[e.id] ?? 0} onChange={(v) => setSales(i, e.id, v ?? 0)} ariaLabel={`${m.month} ${e.name} sales`} />
                    </td>
                  ))}
                  <td className={tdR}>{money(cur.months[i].totals.total)}</td>
                  <td className={`${tdR} font-semibold`}>{money(prop.months[i].totals.total)}</td>
                  <td className={tdR}>{changeLabel(prop.months[i].totals.total - cur.months[i].totals.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className={td}>Year</td>
                <td className={tdR}>{money(prop.revenue)}</td>
                <td className={tdR}>{pct(prop.revenue ? (prop.grossProfit / prop.revenue) * 100 : 0, 1)}</td>
                {prop.byEmployee.map((e) => (
                  <td key={e.id} className={tdR}>
                    {money(e.sales)}
                  </td>
                ))}
                <td className={tdR}>{money(cur.totalComp)}</td>
                <td className={`${tdR} text-base`}>{money(prop.totalComp)}</td>
                <td className={tdR}>{changeLabel(diff)}</td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </Card>

      <Card title="Annual Results">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Annual revenue" value={money(prop.revenue)} />
          <Stat label="Annual estimated gross profit" value={money(prop.grossProfit)} />
          <Stat label="Current plan: annual sales comp" value={money(cur.totalComp)} sub={`${pct(cur.grossProfit ? (cur.totalComp / cur.grossProfit) * 100 : 0, 1)} of GP`} />
          <Stat
            label={`${plan.name}: annual sales comp`}
            value={money(prop.totalComp)}
            sub={`${pct(prop.grossProfit ? (prop.totalComp / prop.grossProfit) * 100 : 0, 1)} of GP`}
          />
          <Stat label="Annual difference (proposed − current)" value={changeLabel(diff)} emphasis sub="Change in company compensation expense" />
          <Stat label="Average monthly sales comp" value={money(prop.avgMonthlyComp)} sub={`Current: ${money(cur.avgMonthlyComp)}`} />
          <Stat label="Total commission" value={money(prop.commission)} sub={`Current: ${money(cur.commission)}`} />
          <Stat label="Total team bonuses" value={money(prop.teamBonuses)} sub={`Current: ${money(cur.teamBonuses)}`} />
          <Stat label="Total performance bonuses" value={money(prop.performanceBonuses)} sub={`Current: ${money(cur.performanceBonuses)}`} />
          <Stat label="Total base pay" value={money(prop.basePay)} sub={`Current: ${money(cur.basePay)}`} />
        </div>
      </Card>

      <Card title="Annual Employee Compensation">
        <Table>
          <thead>
            <tr>
              <th className={th}>Employee</th>
              <th className={thR}>Annual sales</th>
              <th className={thR}>Current plan</th>
              <th className={thR}>{plan.name}</th>
              <th className={thR}>Difference</th>
              <th className={thR}>Avg monthly (proposed)</th>
            </tr>
          </thead>
          <tbody>
            {prop.byEmployee.map((e, i) => (
              <tr key={e.id}>
                <td className={`${td} font-medium`}>{e.name}</td>
                <td className={tdR}>{money(e.sales)}</td>
                <td className={tdR}>{money(cur.byEmployee[i].comp)}</td>
                <td className={`${tdR} font-semibold`}>{money(e.comp)}</td>
                <td className={tdR}>{changeLabel(e.comp - cur.byEmployee[i].comp)}</td>
                <td className={tdR}>{money(e.comp / 12)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
