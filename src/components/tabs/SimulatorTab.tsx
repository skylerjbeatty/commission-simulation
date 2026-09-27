"use client";

import { useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { SectionHeading } from "../ui";
import StoreControls from "../sim/StoreControls";
import ScenarioTesting from "../sim/ScenarioTesting";
import TeamTable from "../sim/TeamTable";
import { CompanyResults, CurrentComparison, EmployeeResults } from "../sim/Results";
import { CliffDetector, IncentiveAnalysis, ProductionTable } from "../sim/PlanFeedback";
import { CostCurve, EarningsCurve } from "../sim/Charts";
import { BreakEvenContext, SensitivityTable, StaffingAnalysis } from "../sim/Insights";
import { calculatePlan } from "@/lib/engine";
import { detectCliffs, incentiveAnalysis, productionTable, sensitivityTable, staffingTable, type ReferenceOptions } from "@/lib/analysis";
import { storeDepartmentMix } from "@/lib/defaults";
import { CURRENT_PLAN_ID } from "@/lib/presets";

export default function SimulatorTab({ onEditPlan }: { onEditPlan: () => void }) {
  const { state, planById } = useApp();
  const plan = planById(state.selectedPlanId);
  const current = planById(CURRENT_PLAN_ID);
  const { scenario, employees } = state;
  const [extraCurvePlans, setExtraCurvePlans] = useState<string[]>([]);

  const result = useMemo(() => calculatePlan(plan, scenario, employees), [plan, scenario, employees]);
  const currentResult = useMemo(() => calculatePlan(current, scenario, employees), [current, scenario, employees]);

  const opts = useMemo<ReferenceOptions>(
    () => ({
      tenureYears: state.referenceTenure,
      mix: storeDepartmentMix(employees),
      headcount: employees.length,
      storeRevenue: result.storeRevenue,
    }),
    [state.referenceTenure, employees, result.storeRevenue],
  );

  const analysis = useMemo(() => incentiveAnalysis(plan, current, scenario, employees, opts), [plan, current, scenario, employees, opts]);
  const cliffs = useMemo(() => detectCliffs(plan, scenario, opts), [plan, scenario, opts]);
  const production = useMemo(() => productionTable(plan, current, scenario, opts), [plan, current, scenario, opts]);
  const staffing = useMemo(
    () => staffingTable(plan, scenario, result.storeRevenue, [3, 4, 5, 6, 7, 8], { tenureYears: opts.tenureYears, mix: opts.mix }),
    [plan, scenario, result.storeRevenue, opts],
  );
  const sensitivity = useMemo(() => sensitivityTable(plan, scenario, employees), [plan, scenario, employees]);
  const curvePlans = useMemo(
    () => [plan, ...extraCurvePlans.filter((id) => id !== plan.id).map(planById)],
    [plan, extraCurvePlans, planById],
  );
  const costOpts = useMemo(() => ({ tenureYears: opts.tenureYears, mix: opts.mix }), [opts]);

  return (
    <div className="space-y-5">
      <StoreControls onEditPlan={onEditPlan} />
      <ScenarioTesting />
      <TeamTable />

      <SectionHeading>Employee Results</SectionHeading>
      <EmployeeResults result={result} plan={plan} />

      <SectionHeading>Company Results</SectionHeading>
      <CompanyResults result={result} />
      <CurrentComparison proposed={result} current={currentResult} plan={plan} />

      <SectionHeading note="Descriptive information for management discussion. The tool does not rank plans.">Plan Feedback</SectionHeading>
      <IncentiveAnalysis sections={analysis} plan={plan} />
      <CliffDetector cliffs={cliffs} plan={plan} />
      <ProductionTable rows={production} plan={plan} tenure={state.referenceTenure} />

      <SectionHeading>Charts</SectionHeading>
      <EarningsCurve
        current={current}
        plans={curvePlans}
        scenario={scenario}
        opts={opts}
        extraControls={
          <details className="relative">
            <summary className="cursor-pointer rounded-md border border-stone-300 px-3 py-1.5 text-sm select-none">Show more plans ({extraCurvePlans.length})</summary>
            <div className="absolute right-0 z-20 mt-1 w-72 space-y-1 rounded-md border border-stone-200 bg-white p-2 shadow-lg">
              {state.plans
                .filter((p) => !p.locked && p.id !== plan.id)
                .map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={extraCurvePlans.includes(p.id)}
                      onChange={(e) =>
                        setExtraCurvePlans((l) => (e.target.checked ? [...l, p.id].slice(-4) : l.filter((x) => x !== p.id)))
                      }
                    />
                    {p.name}
                  </label>
                ))}
              <p className="pt-1 text-xs text-stone-500">Up to 4 additional plans.</p>
            </div>
          </details>
        }
      />
      <CostCurve plan={plan} current={current} scenario={scenario} opts={costOpts} />

      <SectionHeading>Staffing, Break-Even &amp; Sensitivity</SectionHeading>
      <StaffingAnalysis rows={staffing} revenue={result.storeRevenue} scenario={scenario} currentCount={employees.length} plan={plan} />
      <BreakEvenContext scenario={scenario} revenue={result.storeRevenue} />
      <SensitivityTable cells={sensitivity} plan={plan} />
    </div>
  );
}
