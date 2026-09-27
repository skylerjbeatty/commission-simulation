"use client";

import { Badge, Card, Table, td, tdR, th, thR } from "../ui";
import type { AnalysisSection, Cliff, ProductionRow } from "@/lib/analysis";
import { changeLabel, money, pct } from "@/lib/format";
import type { CompensationPlan } from "@/lib/types";

export function IncentiveAnalysis({ sections, plan }: { sections: AnalysisSection[]; plan: CompensationPlan }) {
  return (
    <Card
      title="Plan Feedback — Incentive Analysis"
      subtitle={`Factual observations about ${plan.name}, calculated from fixed rules. No overall score or ranking.`}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((s) => (
          <div key={s.title} className="rounded-lg border border-stone-200 p-4">
            <h3 className="text-sm font-semibold tracking-wide text-stone-800 uppercase">{s.title}</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-700">
              {s.observations.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-400" />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function ProductionTable({ rows, plan, tenure }: { rows: ProductionRow[]; plan: CompensationPlan; tenure: number }) {
  const band = (s: number) => (s < 50000 ? "Low" : s < 70000 ? "Normal" : s < 100000 ? "Strong" : "Exceptional");
  return (
    <Card
      title="Pay at Production Levels"
      subtitle={`A full-time salesperson (${tenure} yrs tenure) at each monthly sales level. Team components use the current store revenue and an equal share.`}
    >
      <Table>
        <thead>
          <tr>
            <th className={th}>Band</th>
            <th className={thR}>Personal sales</th>
            <th className={thR}>Base</th>
            <th className={thR}>Commission</th>
            <th className={thR}>Bonuses</th>
            <th className={thR}>Team</th>
            <th className={thR}>{plan.name}</th>
            <th className={thR}>Guaranteed share</th>
            <th className={thR}>Current plan</th>
            <th className={thR}>Difference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sales}>
              <td className={`${td} text-stone-500`}>{band(r.sales)}</td>
              <td className={`${tdR} font-medium`}>{money(r.sales)}</td>
              <td className={tdR}>{money(r.proposed.basePay)}</td>
              <td className={tdR}>{money(r.proposed.commission + r.proposed.departmentCommission)}</td>
              <td className={tdR}>{money(r.proposed.individualBonuses)}</td>
              <td className={tdR}>{money(r.proposed.teamBonus)}</td>
              <td className={`${tdR} font-bold`}>{money(r.proposed.total)}</td>
              <td className={`${tdR} text-stone-600`}>{pct(r.proposed.guaranteedPct, 0)}</td>
              <td className={tdR}>{money(r.current.total)}</td>
              <td className={`${tdR} font-semibold`}>{changeLabel(r.difference)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

const sizeTone = (s: Cliff["size"]) => (s === "Large" ? "dark" : s === "None" ? "outline" : "neutral");

export function CliffDetector({ cliffs, plan }: { cliffs: Cliff[]; plan: CompensationPlan }) {
  const personal = cliffs.filter((c) => c.kind === "personal");
  const store = cliffs.filter((c) => c.kind === "store");
  return (
    <Card
      title="Cliff Detector"
      subtitle="Pay one dollar below each threshold versus pay at the threshold. Size: Small under $150, Moderate $150–$499, Large $500+."
    >
      {cliffs.length === 0 && <p className="text-sm text-stone-600">{plan.name} has no sales thresholds, so there are no compensation cliffs.</p>}
      {personal.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-semibold text-stone-700">Personal sales thresholds</h3>
          <Table>
            <thead>
              <tr>
                <th className={th}>Threshold</th>
                <th className={th}>Source</th>
                <th className={thR}>Pay just before</th>
                <th className={thR}>Pay at threshold</th>
                <th className={thR}>Jump</th>
                <th className={th}>Size</th>
                <th className={th}>Observation</th>
              </tr>
            </thead>
            <tbody>
              {personal.map((c, i) => (
                <tr key={i}>
                  <td className={`${tdR} text-left font-medium`}>{money(c.at)}</td>
                  <td className={`${td} text-stone-600`}>{c.source}</td>
                  <td className={tdR}>
                    {money(c.payBefore)} <span className="text-xs text-stone-400">at {money(c.before)}</span>
                  </td>
                  <td className={tdR}>{money(c.payAt)}</td>
                  <td className={`${tdR} font-semibold`}>{changeLabel(c.jump)}</td>
                  <td className={td}>
                    <Badge tone={sizeTone(c.size)}>{c.size === "None" ? "No jump" : c.size}</Badge>
                  </td>
                  <td className={`${td} min-w-[280px] text-stone-600`}>{c.message}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
      {store.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-sm font-semibold text-stone-700">Store revenue thresholds (team components)</h3>
          <Table>
            <thead>
              <tr>
                <th className={th}>Store revenue</th>
                <th className={thR}>Per salesperson</th>
                <th className={thR}>Company-wide</th>
                <th className={th}>Size (per person)</th>
                <th className={th}>Observation</th>
              </tr>
            </thead>
            <tbody>
              {store.map((c, i) => (
                <tr key={i}>
                  <td className={`${td} font-medium tabular-nums`}>{money(c.at)}</td>
                  <td className={`${tdR} font-semibold`}>{changeLabel(c.jump)}</td>
                  <td className={tdR}>{changeLabel(c.companyJump ?? 0)}</td>
                  <td className={td}>
                    <Badge tone={sizeTone(c.size)}>{c.size === "None" ? "No jump" : c.size}</Badge>
                  </td>
                  <td className={`${td} min-w-[280px] text-stone-600`}>{c.message}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
      <p className="mt-3 text-xs text-stone-500">
        Thresholds measured in gross profit or department sales are converted to personal sales using the store&apos;s current department mix and margins.
      </p>
    </Card>
  );
}
