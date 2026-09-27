"use client";

import { useState } from "react";
import { useApp } from "../AppContext";
import { Card, NumField, Segmented } from "../ui";
import { applyStoreRevenue, currentStoreRevenue, redistribute } from "@/lib/actions";
import { distributionWeights, type DistributionMode } from "@/lib/defaults";
import { money, pct } from "@/lib/format";

export default function ScenarioTesting() {
  const { state, update } = useApp();
  const revenue = currentStoreRevenue(state);
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState<number | null>(null);
  const d = state.distribution;
  const weights = distributionWeights(state.employees, d.mode, d);
  const activeKey = state.revenuePresets.find((p) => Math.abs(p.revenue - revenue) < 1)?.key ?? "custom";

  const setDist = (patch: Partial<typeof d>) =>
    update((s) => redistribute({ ...s, distribution: { ...s.distribution, ...patch } }));

  return (
    <Card
      title="Scenario Testing"
      subtitle="Pick a store month, then choose how that revenue is split across salespeople. Month values are editable starting points, not fixed definitions."
      actions={
        <button className="text-sm text-stone-600 underline" onClick={() => setEditing((e) => !e)}>
          {editing ? "Done editing values" : "Edit month values"}
        </button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {state.revenuePresets.map((p, i) => (
          <div key={p.key} className="flex flex-col gap-1">
            <button
              onClick={() => update((s) => applyStoreRevenue(s, p.revenue))}
              className={`rounded-lg border px-4 py-2 text-left ${
                activeKey === p.key ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white hover:bg-stone-50"
              }`}
            >
              <div className="text-xs font-semibold tracking-wide uppercase opacity-80">{p.label}</div>
              <div className="text-lg font-semibold tabular-nums">{money(p.revenue)}</div>
            </button>
            {editing && (
              <NumField
                size="sm"
                prefix="$"
                decimals={0}
                value={p.revenue}
                ariaLabel={`${p.label} revenue`}
                onChange={(v) =>
                  update((s) => ({
                    ...s,
                    revenuePresets: s.revenuePresets.map((x, j) => (j === i ? { ...x, revenue: v ?? 0 } : x)),
                  }))
                }
              />
            )}
          </div>
        ))}
        <div
          className={`flex flex-col justify-center gap-1 rounded-lg border px-3 py-2 ${activeKey === "custom" ? "border-stone-900" : "border-stone-300"}`}
        >
          <div className="text-xs font-semibold tracking-wide text-stone-600 uppercase">Custom</div>
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (custom !== null) update((s) => applyStoreRevenue(s, custom));
            }}
          >
            <NumField size="sm" prefix="$" decimals={0} value={custom ?? revenue} onChange={setCustom} className="w-32" ariaLabel="Custom revenue" />
            <button type="submit" className="rounded-md bg-stone-900 px-2 text-sm text-white">
              Apply
            </button>
          </form>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-stone-700">Split revenue across salespeople:</span>
        <Segmented<DistributionMode>
          value={d.mode}
          onChange={(mode) => setDist({ mode })}
          options={[
            { value: "proportional", label: "Keep current proportions" },
            { value: "equal", label: "Equal" },
            { value: "topHeavy", label: "Top-heavy" },
            { value: "custom", label: "Custom %" },
          ]}
        />
      </div>
      {d.mode === "topHeavy" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm text-stone-600" htmlFor="topheavy">
            Concentration toward the top of the list
          </label>
          <input
            id="topheavy"
            type="range"
            min={0}
            max={50}
            value={d.topHeavyIntensity}
            onChange={(e) => setDist({ topHeavyIntensity: Number(e.target.value) })}
            className="w-64"
          />
          <span className="text-sm tabular-nums text-stone-600">{d.topHeavyIntensity}%</span>
          <span className="text-xs text-stone-500">Each person in the list gets {100 - d.topHeavyIntensity}% of the person above. Reorder by editing names.</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {state.employees.map((e, i) => (
          <div key={e.id} className="rounded-md bg-stone-50 px-3 py-1.5 text-sm">
            <span className="font-medium">{e.name}</span>{" "}
            {d.mode === "custom" ? (
              <span className="inline-flex items-center gap-1">
                <NumField
                  size="sm"
                  suffix="%"
                  className="inline-flex w-20"
                  value={d.customShares[e.id] ?? Math.round(10000 / state.employees.length) / 100}
                  onChange={(v) => setDist({ customShares: { ...d.customShares, [e.id]: v ?? 0 } })}
                  ariaLabel={`${e.name} share`}
                />
              </span>
            ) : (
              <span className="text-stone-500 tabular-nums">{pct(weights[i] * 100, 1)}</span>
            )}
            <span className="ml-1 text-stone-500 tabular-nums">· {money(revenue * weights[i])}</span>
          </div>
        ))}
      </div>
      {d.mode === "custom" && (
        <p className="mt-2 text-xs text-stone-500">Custom shares are normalized to 100% (they currently add to {pct(Object.values(state.employees.map((e) => d.customShares[e.id] ?? 100 / state.employees.length)).reduce((a, b) => a + b, 0), 1)}).</p>
      )}
    </Card>
  );
}
