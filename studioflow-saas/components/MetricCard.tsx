import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  detail
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <div className="mt-3 text-3xl font-bold text-studio-ink">{value}</div>
      {detail ? <p className="mt-2 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}
