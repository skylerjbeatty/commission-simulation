# Guion's Sales Compensation Simulator

An internal decision-making sandbox for Guion's Showcase Furniture & Appliances. Change compensation variables and salesperson performance and immediately see what each person earns, what the plan costs, how it compares with the current plan, where commission cliffs are, and what behaviors the plan rewards.

The tool describes tradeoffs. It never ranks plans or recommends one.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm test           # unit tests for the calculation engine (Vitest)
npm run lint
npm run build      # production build
npm start          # serve the production build
```

## Deploy

It's a standard Next.js app with no database, environment variables or server code. You can import the repo into Vercel as-is.

## Where things are

| Path | What |
|---|---|
| `src/lib/types.ts` | Data model: `Employee`, `StoreScenario`, `CompensationPlan`, `CommissionTier`, `Bonus`, `TeamPlan`, `DepartmentPlan`, `CalculationResult` |
| `src/lib/engine.ts` | The compensation math, as pure functions with no UI code |
| `src/lib/analysis.ts` | Cliff detector, earnings and cost curves, sensitivity, staffing, incentive observations |
| `src/lib/presets.ts` | The 10 built-in plans (CURRENT GUION'S PLAN is locked) |
| `src/lib/defaults.ts` | Default store settings, sample team, revenue distribution |
| `src/lib/annual.ts` | 12-month simulation |
| `src/lib/__tests__/` | Unit tests, including every boundary from $29,999 to $100,000 |
| `src/components/` | UI (tabs: Simulator, Compare Plans, Annual Simulation, Plan Builder) |

## Storage

The working scenario and saved scenarios are stored in the browser's `localStorage`. They don't sync between computers or browsers.

## Calculation conventions

- Rates and margins are entered as percents (2 = 2%).
- A tier applies once the amount is **at or above** its threshold.
- **Retroactive** tiers apply the achieved rate to all monthly sales. **Marginal** tiers apply each rate only to the dollars inside its bracket.
- Personal gross profit = department sales × department margin. Blank department margins use the storewide margin.
- Store gross profit = store revenue × storewide gross margin.
- Bonuses stack. Bonuses triggered by store sales or store GP count as team pay.
- Fixed-threshold team bonuses pay the amount for the highest threshold reached (they are not cumulative).
