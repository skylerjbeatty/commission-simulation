"use client";

import { useApp } from "../AppContext";
import { Button, NumField, Select, Toggle } from "../ui";
import { setTransactions } from "@/lib/actions";
import { DEPARTMENT_LABELS } from "@/lib/defaults";
import { activeTransactions, excessCommissionDetail } from "@/lib/engine";
import { money } from "@/lib/format";
import { uid } from "@/lib/presets";
import { DEPARTMENTS, type Department, type Employee, type SaleTransaction } from "@/lib/types";

/** Individual sales for one salesperson, in booking order. */
export default function TransactionEditor({ employee: e, onClose }: { employee: Employee; onClose: () => void }) {
  const { state, update, planById } = useApp();
  const plan = planById(state.selectedPlanId);
  const txs = e.transactions ?? [];
  const on = !!e.useTransactions;
  const save = (next: SaleTransaction[], use = on) => update((s) => setTransactions(s, e.id, next, use));
  const set = (i: number, patch: Partial<SaleTransaction>) => save(txs.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= txs.length) return;
    const next = [...txs];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const threshold = plan.commission.basis === "personalExcessByDepartment" ? (plan.commission.excessThreshold ?? 0) : null;

  // Running total and per-sale commission (for threshold plans) so it's clear which sales cross the goal.
  const rows: { after: number; above: number; commission: number; counts: boolean }[] = [];
  for (const t of txs) {
    const counts = !t.returned && t.amount > 0;
    const before = rows.length ? rows[rows.length - 1].after : 0;
    const after = counts ? before + t.amount : before;
    const above = threshold !== null && counts ? Math.max(0, after - Math.max(threshold, before)) : 0;
    const rate = threshold !== null ? (plan.commission.departmentRatesPct?.[t.department] ?? 0) : 0;
    rows.push({ after, above, commission: (above * rate) / 100, counts });
  }
  const detail = threshold !== null ? excessCommissionDetail({ ...e, useTransactions: true }, plan.commission) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{e.name}&apos;s transactions (booking order, first sale at top)</div>
          <div className="text-xs text-stone-500">
            When on, {e.name}&apos;s department sales are the totals of these transactions. Returned sales are removed and their commission reversed.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={on} onChange={(v) => save(txs, v)} label="Use transactions" />
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      {txs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500">
                <th className="px-1 py-1">#</th>
                <th className="px-1 py-1">Department</th>
                <th className="px-1 py-1 text-right">Amount</th>
                <th className="px-1 py-1">Delivered</th>
                <th className="px-1 py-1">Returned</th>
                <th className="px-1 py-1 text-right">Running total</th>
                {threshold !== null && <th className="px-1 py-1 text-right">Above {money(threshold)}</th>}
                {threshold !== null && <th className="px-1 py-1 text-right">Commission</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {txs.map((t, i) => (
                <tr key={t.id} className={t.returned ? "text-stone-400 line-through" : ""}>
                  <td className="px-1 py-1 text-stone-500">{i + 1}</td>
                  <td className="px-1 py-1">
                    <Select<Department>
                      value={t.department}
                      onChange={(department) => set(i, { department })}
                      options={DEPARTMENTS.map((d) => ({ value: d, label: DEPARTMENT_LABELS[d] }))}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <NumField size="sm" className="ml-auto w-28" prefix="$" min={0} value={t.amount} onChange={(v) => set(i, { amount: v ?? 0 })} ariaLabel="Transaction amount" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="checkbox" checked={t.delivered} onChange={(ev) => set(i, { delivered: ev.target.checked })} aria-label="Delivered" />
                  </td>
                  <td className="px-1 py-1">
                    <input type="checkbox" checked={t.returned} onChange={(ev) => set(i, { returned: ev.target.checked })} aria-label="Returned" />
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">{rows[i].counts ? money(rows[i].after) : "—"}</td>
                  {threshold !== null && <td className="px-1 py-1 text-right tabular-nums">{rows[i].above > 0 ? money(rows[i].above) : "—"}</td>}
                  {threshold !== null && (
                    <td className="px-1 py-1 text-right tabular-nums">
                      {rows[i].commission > 0 ? money(rows[i].commission, 2) : "—"}
                      {rows[i].commission > 0 && !t.delivered && <div className="text-[11px] text-stone-500">pending delivery</div>}
                    </td>
                  )}
                  <td className="px-1 py-1 whitespace-nowrap">
                    <button className="px-1 text-stone-500 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button className="px-1 text-stone-500 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === txs.length - 1} aria-label="Move down">
                      ↓
                    </button>
                    <button className="ml-1 px-1 text-xs text-stone-500 hover:text-red-700" onClick={() => save(txs.filter((_, j) => j !== i))}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() =>
            save([...txs, { id: uid("tx"), department: txs[txs.length - 1]?.department ?? "furniture", amount: 2500, delivered: true, returned: false }], true)
          }
        >
          + Add transaction
        </Button>
        <span className="text-sm text-stone-600">
          {activeTransactions(e).length} counted · total {money(activeTransactions(e).reduce((a, t) => a + t.amount, 0))}
          {detail && threshold !== null && (
            <>
              {" "}
              · commission above {money(threshold)}: <span className="font-semibold">{money(detail.excessCommission, 2)}</span>
              {detail.pendingDelivery > 0 && <> ({money(detail.pendingDelivery, 2)} pending delivery)</>}
            </>
          )}
        </span>
      </div>
      {!on && txs.length > 0 && <p className="text-xs text-stone-500">Transactions are saved but not used. Turn on &ldquo;Use transactions&rdquo; to calculate from them.</p>}
    </div>
  );
}
