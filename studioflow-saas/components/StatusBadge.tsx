import clsx from "clsx";

const statusStyles: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700",
  New: "bg-blue-50 text-blue-700",
  "Waiting for files": "bg-amber-50 text-amber-800",
  "Waiting for retouch": "bg-orange-50 text-orange-700",
  "In retouch": "bg-indigo-50 text-indigo-700",
  "Ready for review": "bg-violet-50 text-violet-700",
  "Ready for delivery": "bg-emerald-50 text-emerald-700",
  Delivered: "bg-green-50 text-green-700",
  Cancelled: "bg-stone-100 text-stone-600",
  "Not started": "bg-slate-100 text-slate-700",
  "Sent to retoucher": "bg-orange-50 text-orange-700",
  "In progress": "bg-indigo-50 text-indigo-700",
  "Needs changes": "bg-red-50 text-red-700",
  Done: "bg-emerald-50 text-emerald-700",
  Approved: "bg-green-50 text-green-700",
  "Not paid": "bg-red-50 text-red-700",
  "Partly paid": "bg-amber-50 text-amber-800",
  Paid: "bg-green-50 text-green-700",
  Refunded: "bg-slate-100 text-slate-700"
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-3 py-1 text-xs font-bold",
        statusStyles[status] ?? "bg-slate-100 text-slate-700",
        className
      )}
    >
      {status}
    </span>
  );
}
