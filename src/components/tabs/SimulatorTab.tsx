"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useApp } from "../AppContext";
import { SectionHeading } from "../ui";
import StoreControls from "../sim/StoreControls";
import ScenarioTesting from "../sim/ScenarioTesting";
import TeamTable from "../sim/TeamTable";
import { CompanyResults, CurrentComparison, EmployeeResults } from "../sim/Results";
import { CliffDetector, IncentiveAnalysis, ProductionTable } from "../sim/PlanFeedback";
import { CostCurve } from "../sim/Charts";
import EarningsWorkbench from "../sim/EarningsWorkbench";
import EarningsStory from "../sim/EarningsStory";
import { BreakEvenContext, SensitivityTable, StaffingAnalysis } from "../sim/Insights";
import { calculatePlan } from "@/lib/engine";
import { detectCliffs, incentiveAnalysis, productionTable, sensitivityTable, staffingTable, type ReferenceOptions } from "@/lib/analysis";
import { storeDepartmentMix } from "@/lib/defaults";
import { CURRENT_PLAN_ID, firstSaleVariant, supportsFirstSaleVariant } from "@/lib/presets";

export default function SimulatorTab({ onEditPlan }: { onEditPlan: () => void }) {
  const { state, planById } = useApp();
  const plan = planById(state.selectedPlanId);
  const current = planById(CURRENT_PLAN_ID);
  const { scenario, employees } = state;
  const [extraCurvePlans, setExtraCurvePlans] = useState<string[]>([]);

  const result = useMemo(() => calculatePlan(plan, scenario, employees), [plan, scenario, employees]);
  const currentResult = useMemo(() => calculatePlan(current, scenario, employees), [current, scenario, employees]);
  // Optional "small commission from the first sale" variation, compared side by side without changing the plan.
  const variantPlan = useMemo(
    () => (state.firstSaleVariant.enabled && supportsFirstSaleVariant(plan) ? firstSaleVariant(plan, state.firstSaleVariant.ratePct) : null),
    [plan, state.firstSaleVariant],
  );
  const variantResult = useMemo(() => (variantPlan ? calculatePlan(variantPlan, scenario, employees) : null), [variantPlan, scenario, employees]);

  const opts = useMemo<ReferenceOptions>(
    () => ({
      tenureYears: state.referenceTenure,
      mix: storeDepartmentMix(employees),
      headcount: employees.length,
      managerCount: employees.filter((e) => e.isManager).length,
      storeRevenue: result.storeRevenue,
    }),
    [state.referenceTenure, employees, result.storeRevenue],
  );

  // The heavier analysis sections follow deferred copies, so slider drags keep the curve and results responsive.
  const dPlan = useDeferredValue(plan);
  const dScenario = useDeferredValue(scenario);
  const dEmployees = useDeferredValue(employees);
  const dOpts = useDeferredValue(opts);
  const analysis = useMemo(() => incentiveAnalysis(dPlan, current, dScenario, dEmployees, dOpts), [dPlan, current, dScenario, dEmployees, dOpts]);
  const cliffs = useMemo(() => detectCliffs(dPlan, dScenario, dOpts), [dPlan, dScenario, dOpts]);
  const production = useMemo(() => productionTable(dPlan, current, dScenario, dOpts), [dPlan, current, dScenario, dOpts]);
  const staffing = useMemo(
    () => staffingTable(dPlan, dScenario, dOpts.storeRevenue ?? 0, [3, 4, 5, 6, 7, 8], { tenureYears: dOpts.tenureYears, mix: dOpts.mix }),
    [dPlan, dScenario, dOpts],
  );
  const sensitivity = useMemo(() => sensitivityTable(dPlan, dScenario, dEmployees), [dPlan, dScenario, dEmployees]);
  const curvePlans = useMemo(
    () => [plan, ...extraCurvePlans.filter((id) => id !== plan.id).map(planById)],
    [plan, extraCurvePlans, planById],
  );
  const costOpts = useMemo(() => ({ tenureYears: dOpts.tenureYears, mix: dOpts.mix }), [dOpts]);

  return (
    <div className="space-y-5">
      <StoreControls onEditPlan={onEditPlan} />
      <ScenarioTesting />
      <TeamTable />

      <SectionHeading>Employee Results</SectionHeading>
      <EarningsStory plan={plan} result={result} current={currentResult} variant={variantResult} />
      <EmployeeResults result={result} plan={plan} />

      <SectionHeading>Company Results</SectionHeading>
      <CompanyResults result={result} />
      <CurrentComparison proposed={result} current={currentResult} plan={plan} employees={employees} variant={variantResult} variantName={variantPlan?.name} />

      <SectionHeading note="Descriptive information for management discussion. The tool does not rank plans.">Plan Feedback</SectionHeading>
      <IncentiveAnalysis sections={analysis} plan={dPlan} />
      <CliffDetector cliffs={cliffs} plan={dPlan} />
      <ProductionTable rows={production} plan={dPlan} tenure={dOpts.tenureYears ?? 0} />

      <SectionHeading>Charts</SectionHeading>
      <EarningsWorkbench
        plan={plan}
        current={current}
        extraPlans={variantPlan ? [...curvePlans, variantPlan] : curvePlans}
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
      <CostCurve plan={dPlan} current={current} scenario={dScenario} opts={costOpts} />

      <SectionHeading>Staffing, Break-Even &amp; Sensitivity</SectionHeading>
      <StaffingAnalysis rows={staffing} revenue={dOpts.storeRevenue ?? 0} scenario={dScenario} currentCount={dEmployees.length} plan={dPlan} />
      <BreakEvenContext scenario={scenario} revenue={result.storeRevenue} />
      <SensitivityTable cells={sensitivity} plan={dPlan} />
    </div>
  );
}
