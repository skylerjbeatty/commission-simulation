"use client";

import { Card, Note, Stat, Table, td, tdR, th, thR } from "../ui";
import type { SensitivityCell, StaffingRow } from "@/lib/analysis";
import { money, pct } from "@/lib/format";
import type { CompensationPlan, StoreScenario } from "@/lib/types";

export function StaffingAnalysis({
  rows,
  revenue,
  scenario,
  currentCount,
  plan,
}: {
  rows: StaffingRow[];
  revenue: number;
  scenario: StoreScenario;
  currentCount: number;
  plan: CompensationPlan;
}) {
  const monthly = scenario.customersPerDay * scenario.openDaysPerMonth;
  return (
    <Card
      title="Store Staffing Analysis"
      subtitle={`The same ${money(revenue)} of store revenue and ${monthly.toLocaleString()} customers per month (${scenario.customersPerDay}/day × ${scenario.openDaysPerMonth} open days), divided among different numbers of salespeople.`}
    >
      <Table>
        <thead>
          <tr>
            <th className={th}>Salespeople</th>
            <th className={thR}>Revenue ÷ salespeople</th>
            <th className={thR}>Gross profit ÷ salespeople</th>
            <th className={thR}>Customer opportunities per salesperson*</th>
            <th className={thR}>Per day*</th>
            <th className={thR}>Total sales comp ({plan.name})</th>
            <th className={thR}>Avg comp per salesperson</th>
            <th className={thR}>Comp % of GP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.salespeople} className={r.salespeople === currentCount ? "bg-stone-50 font-semibold" : ""}>
              <td className={td}>
                {money(revenue)} / {r.salespeople}
                {r.salespeople === currentCount && <span className="ml-2 text-xs font-normal text-stone-500">(current)</span>}
              </td>
              <td className={tdR}>{money(r.revenuePerPerson)}</td>
              <td className={tdR}>{money(r.gpPerPerson)}</td>
              <td className={tdR}>{Math.round(r.opportunitiesPerPerson).toLocaleString()}</td>
              <td className={tdR}>{(scenario.customersPerDay / r.salespeople).toFixed(1)}</td>
              <td className={tdR}>{money(r.totalComp)}</td>
              <td className={tdR}>{money(r.avgComp)}</td>
              <td className={tdR}>{pct(r.compPctGP, 1)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-stone-500">
        *EVEN-DISTRIBUTION ESTIMATE. Customer &ldquo;ups&rdquo; are divided equally only to illustrate how the same traffic is shared among more
        people. Salespeople do not actually receive equal opportunities. Compensation columns assume every salesperson is full-time and sells an
        equal share.
      </p>
    </Card>
  );
}

export function BreakEvenContext({ scenario, revenue }: { scenario: StoreScenario; revenue: number }) {
  const be = scenario.estimatedBreakEvenRevenue;
  const beGP = (be * scenario.grossMarginPct) / 100;
  const gp = (revenue * scenario.grossMarginPct) / 100;
  return (
    <Card title="Break-Even Context" subtitle="Estimated Store Break-Even Revenue is a discussion number, not an accounting fact.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Estimated Store Break-Even Revenue" value={money(be)} />
        <Stat label={`Estimated gross profit at ${pct(scenario.grossMarginPct, 1)}`} value={money(beGP)} />
        <Stat label="This scenario's revenue" value={money(revenue)} sub={`${revenue >= be ? "+" : "−"}${money(Math.abs(revenue - be))} vs estimate`} />
        <Stat label="This scenario's estimated gross profit" value={money(gp)} />
      </div>
      <div className="mt-3">
        <Note>
          Gross profit is not net profit. Operating expenses, payroll, delivery, occupancy, advertising, utilities, service, and other expenses
          still must be paid.
        </Note>
      </div>
    </Card>
  );
}

export function SensitivityTable({ cells, plan }: { cells: SensitivityCell[]; plan: CompensationPlan }) {
  const revenues = [...new Set(cells.map((c) => c.revenue))];
  const margins = [...new Set(cells.map((c) => c.marginPct))];
  const get = (r: number, m: number) => cells.find((c) => c.revenue === r && c.marginPct === m)!;
  return (
    <Card
      title="Sensitivity Test"
      subtitle={`${plan.name} at different store revenue and gross margin levels. Salesperson sales are scaled in their current proportions.`}
    >
      <Table>
        <thead>
          <tr>
            <th className={th}>Store revenue</th>
            <th className={thR}>Sales compensation</th>
            <th className={thR}>Comp % revenue</th>
            {margins.map((m) => (
              <th key={`p${m}`} className={thR}>
                Comp % GP @ {m}%
              </th>
            ))}
            {margins.map((m) => (
              <th key={`g${m}`} className={thR}>
                GP after comp @ {m}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {revenues.map((r) => {
            const base = get(r, margins[1] ?? margins[0]);
            const varies = margins.some((m) => Math.abs(get(r, m).comp - base.comp) > 0.5);
            return (
              <tr key={r}>
                <td className={`${td} font-medium tabular-nums`}>{money(r)}</td>
                <td className={tdR}>
                  {varies ? margins.map((m) => money(get(r, m).comp)).join(" / ") : money(base.comp)}
                </td>
                <td className={tdR}>{pct(base.compPctRevenue, 2)}</td>
                {margins.map((m) => (
                  <td key={`p${m}`} className={tdR}>
                    {pct(get(r, m).compPctGP, 1)}
                  </td>
                ))}
                {margins.map((m) => (
                  <td key={`g${m}`} className={tdR}>
                    {money(get(r, m).gpAfterComp)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p className="mt-3 text-xs text-stone-500">
        When a plan pays on gross profit, compensation itself changes with margin; the sales compensation column then lists one value per margin
        ({margins.join("% / ")}%).
      </p>
    </Card>
  );
}
