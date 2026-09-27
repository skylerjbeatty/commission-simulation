"use client";

import { useState, type ReactNode } from "react";

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-lg font-semibold text-stone-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function SectionHeading({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="mt-2 mb-3">
      <h2 className="text-xs font-semibold tracking-widest text-stone-500 uppercase">{children}</h2>
      {note && <p className="mt-1 text-sm text-stone-500">{note}</p>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  emphasis = false,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 ${emphasis ? "bg-stone-900 text-white" : "bg-stone-50"}`}>
      <div className={`text-xs font-medium ${emphasis ? "text-stone-300" : "text-stone-500"}`}>{label}</div>
      <div className={`mt-1 font-semibold tabular-nums ${emphasis ? "text-3xl" : "text-2xl text-stone-900"}`}>{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${emphasis ? "text-stone-300" : "text-stone-500"}`}>{sub}</div>}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  title,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  title?: string;
  className?: string;
  type?: "button" | "submit";
}) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-stone-900 text-white hover:bg-stone-700",
    secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50",
    ghost: "text-stone-600 hover:bg-stone-100",
    danger: "border border-stone-300 bg-white text-red-700 hover:bg-red-50",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function formatNumber(v: number, decimals: number) {
  return v.toLocaleString("en-US", { maximumFractionDigits: decimals, useGrouping: true });
}

/** Numeric input that lets you type freely and commits parsed numbers. */
export function NumField({
  value,
  onChange,
  prefix,
  suffix,
  decimals = 2,
  allowEmpty = false,
  placeholder,
  min,
  max,
  className = "",
  inputClassName = "",
  ariaLabel,
  size = "md",
  disabled,
}: {
  disabled?: boolean;
  value: number | null;
  onChange: (v: number | null) => void;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  allowEmpty?: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null || value === undefined ? "" : formatNumber(value, decimals));
  const commit = (raw: string) => {
    const cleaned = raw.replace(/[$,%\s]/g, "");
    if (cleaned === "") {
      if (allowEmpty) onChange(null);
      return;
    }
    let n = Number(cleaned);
    if (!Number.isFinite(n)) return;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
  };
  const sizes = { sm: "py-1 text-sm", md: "py-1.5 text-sm", lg: "py-2 text-xl font-semibold" };
  return (
    <div
      className={`flex items-center rounded-md border border-stone-300 bg-white focus-within:border-stone-600 focus-within:ring-1 focus-within:ring-stone-600 has-[:disabled]:bg-stone-50 ${className}`}
    >
      {prefix && <span className="pl-2 text-stone-400 select-none">{prefix}</span>}
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        disabled={disabled}
        className={`w-full min-w-0 bg-transparent px-2 tabular-nums outline-none disabled:text-stone-500 ${sizes[size]} ${inputClassName}`}
        value={shown}
        placeholder={placeholder}
        onFocus={(e) => {
          setDraft(value === null || value === undefined ? "" : String(value));
          // Select everything after React swaps in the unformatted value, so typing replaces it.
          const el = e.currentTarget;
          requestAnimationFrame(() => {
            if (document.activeElement === el) el.select();
          });
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setDraft(null)}
      />
      {suffix && <span className="pr-2 text-stone-400 select-none">{suffix}</span>}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block max-w-full min-w-0 ${className}`}>
      <span className="mb-1 block text-xs font-medium text-stone-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  className = "",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`max-w-full min-w-0 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600 disabled:bg-stone-50 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TextField({
  value,
  onChange,
  className = "",
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600 disabled:bg-stone-50 ${className}`}
    />
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-700">
      <span className="relative inline-flex">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-5 w-9 rounded-full bg-stone-300 transition-colors peer-checked:bg-stone-800 peer-focus-visible:ring-2 peer-focus-visible:ring-stone-500" />
        <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
      </span>
      {label}
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-stone-300 bg-stone-50 p-0.5">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium ${
            value === o.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small "?" with an explanation shown on hover/focus. */
export function Info({ children }: { children: ReactNode }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <span
        tabIndex={0}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-stone-400 text-[10px] font-semibold text-stone-500 outline-none"
      >
        ?
      </span>
      <span className="pointer-events-none invisible absolute top-5 left-1/2 z-30 w-72 -translate-x-1/2 rounded-md bg-stone-900 p-3 text-xs leading-relaxed font-normal text-white opacity-0 shadow-lg group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        {children}
      </span>
    </span>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">{children}</p>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "dark" | "outline" }) {
  const t = {
    neutral: "bg-stone-100 text-stone-700",
    dark: "bg-stone-800 text-white",
    outline: "border border-stone-300 text-stone-600",
  }[tone];
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${t}`}>{children}</span>;
}

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className={`w-full border-collapse text-sm ${className}`}>{children}</table>
    </div>
  );
}

export const th = "border-b border-stone-200 px-2 py-2 text-left text-xs font-semibold text-stone-500 whitespace-nowrap";
export const thR = `${th} text-right`;
export const td = "border-b border-stone-100 px-2 py-1.5 align-middle";
export const tdR = `${td} text-right tabular-nums whitespace-nowrap`;

/** Labeled range slider with the current value shown on the right. */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  disabled,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  disabled?: boolean;
}) {
  return (
    <label className={`block ${disabled ? "opacity-50" : ""}`}>
      <span className="flex items-baseline justify-between gap-2 text-xs text-stone-600">
        <span>{label}</span>
        <span className="text-sm font-semibold text-stone-900 tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        className="mt-1 w-full"
        min={min}
        max={Math.max(max, value)}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
