"use client";

import { useMemo, useState } from "react";
import { Card, Segmented } from "../ui";
import { CURRENT_COLOR, LineChart, SERIES_COLORS, type Series } from "../LineChart";
import { companyCostCurve, earningsCurve, tracksFor, type ReferenceOptions } from "@/lib/analysis";
import { kMoney, money } from "@/lib/format";
import type { CompensationPlan, StoreScenario } from "@/lib/types";

export function EarningsCurve({
  current,
  plans,
  scenario,
  opts,
  extraControls,
}: {
  current: CompensationPlan;
  plans: CompensationPlan[];
  scenario: StoreScenario;
  opts: ReferenceOptions;
  extraControls?: React.ReactNode;
}) {
  const series = useMemo<Series[]>(() => {
    const out: Series[] = [
      { id: current.id, name: "Current plan", color: CURRENT_COLOR, dashed: true, points: earningsCurve(current, scenario, opts) },
    ];
    let slot = 0;
    for (const p of plans) {
      if (p.id === current.id) continue;
      for (const t of tracksFor(p)) {
        out.push({
          id: `${p.id}-${t}`,
          name: p.tracks.enabled ? `${p.name} · ${p.tracks[t].label}` : p.name,
          color: SERIES_COLORS[slot % SERIES_COLORS.length],
          points: earningsCurve(p, scenario, { ...opts, track: t }),
        });
        slot++;
      }
    }
    return out;
  }, [current, plans, scenario, opts]);

  return (
    <Card
      title="Employee Earnings Curve"
      subtitle={`Monthly pay for one full-time salesperson (${opts.tenureYears ?? 0} yrs tenure) from $0 to $120,000 in personal sales. Vertical steps are commission cliffs. Team components are held at the current store revenue (${money(opts.storeRevenue ?? 0)}).`}
      actions={extraControls}
    >
      <LineChart series={series} xFormat={kMoney} yFormat={(v) => money(v)} xLabel="Personal monthly sales" yLabel="Monthly compensation" />
    </Card>
  );
}

export function CostCurve({
  plan,
  current,
  scenario,
  opts,
}: {
  plan: CompensationPlan;
  current: CompensationPlan;
  scenario: StoreScenario;
  opts: { tenureYears?: number; mix?: ReferenceOptions["mix"] };
}) {
  const [which, setWhich] = useState<"selected" | "current">("selected");
  const p = which === "selected" ? plan : current;
  const series = useMemo<Series[]>(
    () =>
      [3, 4, 5, 6].map((n, i) => ({
        id: `n${n}`,
        name: `${n} salespeople`,
        color: SERIES_COLORS[i],
        points: companyCostCurve(p, scenario, n, opts),
      })),
    [p, scenario, opts],
  );
  return (
    <Card
      title="Company Cost Curve"
      subtitle={`Total monthly sales compensation for ${p.name} as store revenue changes from $150k to $350k, with revenue split equally among 3–6 salespeople (full-time, ${opts.tenureYears ?? 0} yrs tenure).`}
      actions={
        plan.locked ? undefined : (
          <Segmented
            value={which}
            onChange={setWhich}
            options={[
              { value: "selected", label: "Selected plan" },
              { value: "current", label: "Current plan" },
            ]}
          />
        )
      }
    >
      <LineChart series={series} xFormat={kMoney} yFormat={(v) => kMoney(v)} xLabel="Store revenue" yLabel="Total sales compensation" />
    </Card>
  );
}
