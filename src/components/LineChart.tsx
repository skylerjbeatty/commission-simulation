"use client";

import { useMemo, useRef, useState } from "react";
import type { CurvePoint } from "@/lib/analysis";

export interface Series {
  id: string;
  name: string;
  color: string;
  points: CurvePoint[];
  dashed?: boolean;
}

/** Categorical slots (validated reference palette). The current plan uses neutral ink. */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];
export const CURRENT_COLOR = "#44403c";

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  // Always end on a tick at or above the max so no data is drawn outside the plot area.
  for (let v = start; ; v += step) {
    ticks.push(Math.round(v * 100) / 100);
    if (v >= max - 1e-9) break;
  }
  return ticks;
}

/** Value of a (dense) series at x: last point at or before x. */
function valueAt(points: CurvePoint[], x: number): CurvePoint | undefined {
  let lo = 0;
  let hi = points.length - 1;
  if (!points.length || x < points[0].x) return points[0];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (points[mid].x <= x) lo = mid;
    else hi = mid - 1;
  }
  return points[lo];
}

export function LineChart({
  series,
  xFormat,
  yFormat,
  xLabel,
  yLabel,
  height = 320,
  yMin,
  markerX,
}: {
  series: Series[];
  xFormat: (v: number) => string;
  yFormat: (v: number) => string;
  xLabel: string;
  yLabel: string;
  height?: number;
  yMin?: number;
  /** Optional x value to highlight with a solid vertical line and dots (e.g. a chosen sales level). */
  markerX?: number;
}) {
  const W = 820;
  const H = height;
  const pad = { l: 64, r: 128, t: 12, b: 44 };
  const ref = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const { xMin, xMax, y0, y1, xTicks, yTicks } = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yt = niceTicks(yMin ?? Math.min(0, ...ys), Math.max(...ys) * 1.05);
    const y0 = yMin ?? Math.min(0, yt[0]);
    const y1 = yt[yt.length - 1] ?? 1;
    return { xMin, xMax, y0, y1, xTicks: niceTicks(xMin, xMax, 6).filter((t) => t <= xMax), yTicks: yt };
  }, [series, yMin]);

  if (!series.length || !series[0].points.length) return null;

  const sx = (x: number) => pad.l + ((x - xMin) / (xMax - xMin || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - ((y - y0) / (y1 - y0 || 1)) * (H - pad.t - pad.b);

  // End-of-line direct labels, nudged apart so they never overlap.
  const labels = series
    .map((s) => ({ s, y: sy(s.points[s.points.length - 1].y) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const x = xMin + ((px - pad.l) / (W - pad.l - pad.r)) * (xMax - xMin);
    setHoverX(x < xMin || x > xMax ? null : x);
  };

  const hoverVals = hoverX === null ? [] : series.map((s) => ({ s, p: valueAt(s.points, hoverX) }));
  const leftPct = hoverX === null ? 0 : (sx(hoverX) / W) * 100;

  return (
    <div className="max-w-[1100px]">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
          {series.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden>
                <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? "4 3" : undefined} />
              </svg>
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <svg
          ref={ref}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHoverX(null)}
          role="img"
          aria-label={`${yLabel} by ${xLabel}`}
        >
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="#e7e5e4" strokeWidth="1" />
              <text x={pad.l - 8} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="#78716c">
                {yFormat(t)}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={H - pad.b + 18} textAnchor="middle" fontSize="11" fill="#78716c">
              {xFormat(t)}
            </text>
          ))}
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#a8a29e" />
          <text x={(pad.l + W - pad.r) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="#57534e">
            {xLabel}
          </text>
          <text x={14} y={(pad.t + H - pad.b) / 2} textAnchor="middle" fontSize="12" fill="#57534e" transform={`rotate(-90 14 ${(pad.t + H - pad.b) / 2})`}>
            {yLabel}
          </text>
          {series.map((s) => (
            <polyline
              key={s.id}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeDasharray={s.dashed ? "6 4" : undefined}
              points={s.points.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ")}
            />
          ))}
          {labels.map(({ s, y }) => (
            <text key={`l${s.id}`} x={W - pad.r + 8} y={y + 4} fontSize="11" fill="#44403c">
              {s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name}
            </text>
          ))}
          {markerX !== undefined && markerX >= xMin && markerX <= xMax && (
            <g>
              <line x1={sx(markerX)} x2={sx(markerX)} y1={pad.t} y2={H - pad.b} stroke="#1c1917" strokeWidth="1.5" />
              {series.map((s) => {
                const p = valueAt(s.points, markerX);
                return p ? <circle key={`m${s.id}`} cx={sx(markerX)} cy={sy(p.y)} r="5" fill={s.color} stroke="#fff" strokeWidth="2" /> : null;
              })}
            </g>
          )}
          {hoverX !== null && (
            <g>
              <line x1={sx(hoverX)} x2={sx(hoverX)} y1={pad.t} y2={H - pad.b} stroke="#78716c" strokeDasharray="3 3" />
              {hoverVals.map(({ s, p }) =>
                p ? <circle key={`h${s.id}`} cx={sx(hoverX)} cy={sy(p.y)} r="4" fill={s.color} stroke="#fff" strokeWidth="2" /> : null,
              )}
            </g>
          )}
        </svg>
        {hoverX !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-md border border-stone-200 bg-white p-2 text-xs shadow-md"
            style={leftPct > 55 ? { right: `${100 - leftPct + 2}%` } : { left: `${leftPct + 2}%` }}
          >
            <div className="mb-1 font-semibold text-stone-800">
              {xLabel}: {xFormat(Math.round(hoverX))}
            </div>
            {hoverVals.map(({ s, p }) => (
              <div key={`t${s.id}`} className="flex items-center justify-between gap-3 text-stone-700">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </span>
                <span className="font-medium tabular-nums">{p ? yFormat(p.y) : "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
