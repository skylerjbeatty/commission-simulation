export function money(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  const v = digits === 0 ? Math.round(n) : n;
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

/** $225k style short label for charts. */
export function kMoney(n: number): string {
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 100) / 10}k`.replace(".0k", "k");
  return money(n);
}

/** Neutral description of a change: never labels a change good or bad. */
export function changeLabel(diff: number): string {
  if (Math.abs(diff) < 0.5) return "No change";
  return `${diff > 0 ? "+" : "−"}${money(Math.abs(diff))}`;
}
