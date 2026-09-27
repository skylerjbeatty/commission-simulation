"use client";

import { useApp } from "../AppContext";
import { Button, Card, NumField, Select, Table, td, tdR, th, thR } from "../ui";
import { addEmployee, removeEmployee } from "@/lib/actions";
import { DEPARTMENT_SHORT, MAX_SALESPEOPLE, MIN_SALESPEOPLE } from "@/lib/defaults";
import { departmentTotal, personalSales } from "@/lib/engine";
import { money } from "@/lib/format";
import { DEPARTMENTS, type Employee, type Track } from "@/lib/types";

export default function TeamTable() {
  const { state, update, planById } = useApp();
  const plan = planById(state.selectedPlanId);
  const setEmp = (id: string, patch: Partial<Employee>) =>
    update((s) => ({ ...s, employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const move = (i: number, dir: -1 | 1) =>
    update((s) => {
      const list = [...s.employees];
      const j = i + dir;
      if (j < 0 || j >= list.length) return s;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...s, employees: list };
    });
  const showTrack = plan.tracks.enabled;
  const showWeight = plan.team.enabled && plan.team.distribution === "custom";
  const n = state.employees.length;
  const total = state.employees.reduce((a, e) => a + personalSales(e), 0);

  return (
    <Card
      title="Sales Team"
      subtitle="Edit names, tenure, hours and sales by department. Personal sales equal the department total unless a row is switched to manual."
      actions={
        <Button onClick={() => update((s) => addEmployee(s))} disabled={n >= MAX_SALESPEOPLE}>
          + Add salesperson
        </Button>
      }
    >
      <Table>
        <thead>
          <tr>
            <th className={th}>Employee</th>
            <th className={thR}>Tenure (yrs)</th>
            <th className={thR}>Hours</th>
            <th className={thR} title="Leave blank to use the plan's hourly rate">
              Wage override
            </th>
            {DEPARTMENTS.map((d) => (
              <th key={d} className={thR}>
                {DEPARTMENT_SHORT[d]} Sales
              </th>
            ))}
            <th className={thR}>Total Sales</th>
            {showTrack && <th className={th}>Track</th>}
            {showWeight && <th className={thR}>Team weight</th>}
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {state.employees.map((e, i) => (
            <tr key={e.id}>
              <td className={td}>
                <input
                  aria-label="Employee name"
                  value={e.name}
                  onChange={(ev) => setEmp(e.id, { name: ev.target.value })}
                  className="w-28 rounded-md border border-stone-300 px-2 py-1 font-medium outline-none focus:border-stone-600"
                />
                <label
                  className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-500"
                  title="Sales manager: sales always count toward store totals. Plans marked 'manager paid separately' don't pay this person."
                >
                  <input type="checkbox" checked={!!e.isManager} onChange={(ev) => setEmp(e.id, { isManager: ev.target.checked })} />
                  manager
                </label>
              </td>
              <td className={tdR}>
                <NumField size="sm" className="w-16" value={e.tenureYears} min={0} onChange={(v) => setEmp(e.id, { tenureYears: v ?? 0 })} ariaLabel="Tenure" />
              </td>
              <td className={tdR}>
                <NumField size="sm" className="w-16" value={e.hoursWorked} min={0} onChange={(v) => setEmp(e.id, { hoursWorked: v ?? 0 })} ariaLabel="Hours" />
              </td>
              <td className={tdR}>
                <NumField
                  size="sm"
                  className="w-20"
                  prefix="$"
                  allowEmpty
                  placeholder="plan"
                  value={e.hourlyWageOverride}
                  min={0}
                  onChange={(v) => setEmp(e.id, { hourlyWageOverride: v })}
                  ariaLabel="Hourly wage override"
                />
              </td>
              {DEPARTMENTS.map((d) => (
                <td key={d} className={tdR}>
                  <NumField
                    size="sm"
                    className="w-24"
                    prefix="$"
                    decimals={0}
                    min={0}
                    value={e.sales[d]}
                    onChange={(v) => setEmp(e.id, { sales: { ...e.sales, [d]: v ?? 0 } })}
                    ariaLabel={`${DEPARTMENT_SHORT[d]} sales`}
                  />
                </td>
              ))}
              <td className={tdR}>
                {e.useDepartmentTotal ? (
                  <div className="font-semibold">{money(departmentTotal(e.sales))}</div>
                ) : (
                  <NumField
                    size="sm"
                    className="ml-auto w-28"
                    prefix="$"
                    decimals={0}
                    min={0}
                    value={e.manualPersonalSales}
                    onChange={(v) => setEmp(e.id, { manualPersonalSales: v ?? 0 })}
                    ariaLabel="Manual personal sales"
                  />
                )}
                <label className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-stone-500">
                  <input
                    type="checkbox"
                    checked={!e.useDepartmentTotal}
                    onChange={(ev) =>
                      setEmp(e.id, {
                        useDepartmentTotal: !ev.target.checked,
                        manualPersonalSales: ev.target.checked ? departmentTotal(e.sales) : e.manualPersonalSales,
                      })
                    }
                  />
                  manual
                </label>
              </td>
              {showTrack && (
                <td className={td}>
                  <Select<Track>
                    value={e.track}
                    onChange={(v) => setEmp(e.id, { track: v })}
                    options={[
                      { value: "stability", label: plan.tracks.stability.label },
                      { value: "performance", label: plan.tracks.performance.label },
                    ]}
                  />
                </td>
              )}
              {showWeight && (
                <td className={tdR}>
                  <NumField size="sm" className="w-16" value={e.teamWeight} min={0} onChange={(v) => setEmp(e.id, { teamWeight: v ?? 0 })} ariaLabel="Team weight" />
                </td>
              )}
              <td className={`${td} whitespace-nowrap`}>
                <button className="px-1 text-stone-500 hover:text-stone-900 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
                <button className="px-1 text-stone-500 hover:text-stone-900 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === n - 1} aria-label="Move down">
                  ↓
                </button>
                <button
                  className="ml-1 px-1 text-xs text-stone-500 hover:text-red-700 disabled:opacity-30"
                  disabled={n <= MIN_SALESPEOPLE}
                  onClick={() => update((s) => removeEmployee(s, e.id))}
                  title={n <= MIN_SALESPEOPLE ? `Minimum ${MIN_SALESPEOPLE} salespeople` : "Delete"}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={`${td} font-semibold`} colSpan={4}>
              Team total
            </td>
            {DEPARTMENTS.map((d) => (
              <td key={d} className={`${tdR} font-semibold`}>
                {money(state.employees.reduce((a, e) => a + (e.sales[d] || 0), 0))}
              </td>
            ))}
            <td className={`${tdR} text-base font-bold`}>{money(total)}</td>
          </tr>
        </tfoot>
      </Table>
      {showTrack && <p className="mt-2 text-xs text-stone-500">This plan has two tracks. Choose each salesperson&apos;s track above.</p>}
      {plan.managersPaidSeparately && (
        <p className="mt-2 text-xs text-stone-500">
          {plan.name} pays managers separately: their sales count toward store sales and the team pool, but they are not paid by this plan and
          don&apos;t share the pool.
        </p>
      )}
    </Card>
  );
}
