"use client";

import { Card, Note, Stat, Table, td, tdR, th, thR } from "../ui";
import { changeLabel, money, pct } from "@/lib/format";
import type { CalculationResult, CompensationPlan } from "@/lib/types";

export function EmployeeResults({ result, plan }: { result: CalculationResult; plan: CompensationPlan }) {
  const t = result.totals;
  return (
    <Card title="Employee Results" subtitle={`Monthly compensation under ${plan.name}.`}>
      <Table>
        <thead>
          <tr>
            <th className={th}>Employee</th>
            <th className={thR}>Total Sales</th>
            <th className={thR}>Hourly</th>
            <th className={thR}>Base Pay</th>
            <th className={thR}>Personal Commission</th>
            <th className={thR}>Department Commission</th>
            <th className={thR}>Individual Bonuses</th>
            <th className={thR}>Team Bonus</th>
            <th className={`${thR} text-stone-800`}>Total Compensation</th>
          </tr>
        </thead>
        <tbody>
          {result.employees.map((e) => (
            <tr key={e.employeeId}>
              <td className={`${td} font-medium`}>{e.name}</td>
              <td className={tdR}>{money(e.personalSales)}</td>
              <td className={`${tdR} text-stone-500`}>{e.hourlyRate ? money(e.hourlyRate, 2) : "—"}</td>
              <td className={tdR}>{money(e.basePay)}</td>
              <td className={tdR}>{money(e.personalCommission)}</td>
              <td className={tdR}>{money(e.departmentCommission)}</td>
              <td className={tdR}>{money(e.individualBonuses)}</td>
              <td className={tdR}>{money(e.teamBonus)}</td>
              <td className={`${tdR} bg-stone-50 text-lg font-bold`}>{money(e.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className={td}>Total</td>
            <td className={tdR}>{money(result.employees.reduce((a, e) => a + e.personalSales, 0))}</td>
            <td className={tdR} />
            <td className={tdR}>{money(t.basePay)}</td>
            <td className={tdR}>{money(t.personalCommission)}</td>
            <td className={tdR}>{money(t.departmentCommission)}</td>
            <td className={tdR}>{money(t.individualBonuses)}</td>
            <td className={tdR}>{money(t.teamBonus)}</td>
            <td className={`${tdR} bg-stone-900 text-lg font-bold text-white`}>{money(t.total)}</td>
          </tr>
        </tfoot>
      </Table>
    </Card>
  );
}

export function CompanyResults({ result }: { result: CalculationResult }) {
  const t = result.totals;
  return (
    <Card title="Company Results" subtitle="What this plan costs the store this month.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total store revenue" value={money(result.storeRevenue)} />
        <Stat label="Estimated gross profit" value={money(result.storeGP)} sub="Revenue × gross margin" />
        <Stat label="TOTAL SALES COMPENSATION" value={money(t.total)} emphasis sub={`${pct(result.compPctRevenue, 2)} of revenue`} />
        <Stat label="Compensation as % of gross profit" value={pct(result.compPctGP, 1)} />
        <Stat label="Base payroll" value={money(t.basePay)} />
        <Stat label="Individual commission" value={money(t.personalCommission)} />
        <Stat label="Department commission" value={money(t.departmentCommission)} />
        <Stat label="Team compensation" value={money(t.teamBonus)} />
        <Stat label="Performance bonuses" value={money(t.individualBonuses)} />
        <Stat label="Gross profit remaining after sales comp" value={money(result.gpAfterComp)} sub="Before all other operating expenses" />
        <Stat label="Revenue per salesperson" value={money(result.revenuePerSalesperson)} />
        <Stat label="Gross profit per salesperson" value={money(result.gpPerSalesperson)} />
        <Stat label="Average compensation per salesperson" value={money(result.avgCompPerSalesperson)} />
        <Stat label="Guaranteed (base) share of comp" value={pct(result.guaranteedPct, 0)} />
        <Stat label="Variable comp tied to team/store" value={pct(result.teamShareOfVariablePct, 0)} />
      </div>
    </Card>
  );
}

export function CurrentComparison({
  proposed,
  current,
  plan,
}: {
  proposed: CalculationResult;
  current: CalculationResult;
  plan: CompensationPlan;
}) {
  if (plan.locked) {
    return (
      <Card title="Compare Against Current Plan">
        <Note>The selected plan is the current Guion&apos;s plan. Select another plan above to compare it with the current structure.</Note>
      </Card>
    );
  }
  const diff = proposed.totals.total - current.totals.total;
  return (
    <Card
      title="Compare Against Current Plan"
      subtitle="Changes are shown neutrally: a pay increase is income for the employee and an expense for the company."
    >
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Table>
          <thead>
            <tr>
              <th className={th}>Employee</th>
              <th className={thR}>Current-plan pay</th>
              <th className={thR}>Proposed-plan pay</th>
              <th className={thR}>Dollar difference</th>
              <th className={thR}>% difference</th>
            </tr>
          </thead>
          <tbody>
            {proposed.employees.map((e, i) => {
              const c = current.employees[i];
              const d = e.total - c.total;
              return (
                <tr key={e.employeeId}>
                  <td className={`${td} font-medium`}>{e.name}</td>
                  <td className={tdR}>{money(c.total)}</td>
                  <td className={tdR}>{money(e.total)}</td>
                  <td className={`${tdR} font-semibold`}>{changeLabel(d)}</td>
                  <td className={`${tdR} text-stone-600`}>{c.total > 0 ? `${d >= 0 ? "+" : "−"}${pct(Math.abs((d / c.total) * 100), 1)}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <div className="grid gap-3">
          <Stat label="Current total sales compensation" value={money(current.totals.total)} sub={`${pct(current.compPctGP, 1)} of gross profit`} />
          <Stat label="Proposed total sales compensation" value={money(proposed.totals.total)} sub={`${pct(proposed.compPctGP, 1)} of gross profit`} />
          <Stat
            label="Change in company compensation expense"
            value={changeLabel(diff)}
            emphasis
            sub={Math.abs(diff) < 0.5 ? "Same cost as current plan" : `${diff > 0 ? "More" : "Less"} than the current plan per month · ${changeLabel(diff * 12)} per year at this pace`}
          />
        </div>
      </div>
    </Card>
  );
}
