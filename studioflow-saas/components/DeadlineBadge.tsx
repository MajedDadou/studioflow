import clsx from "clsx";
import { deadlineState, formatDate } from "@/lib/format";

export function DeadlineBadge({ deadline }: { deadline?: Date | null }) {
  const state = deadlineState(deadline);
  const label = deadline ? formatDate(deadline) : "No deadline";
  return (
    <span
      className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-bold", {
        "bg-red-50 text-red-700": state === "overdue",
        "bg-amber-50 text-amber-800": state === "soon",
        "bg-slate-100 text-slate-700": state === "normal" || state === "none"
      })}
    >
      {state === "overdue" ? "Overdue: " : state === "soon" ? "Soon: " : ""}
      {label}
    </span>
  );
}
