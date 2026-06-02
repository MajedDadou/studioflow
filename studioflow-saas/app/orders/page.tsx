import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { updateOrderStatus } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { deadlineState, formatMoney, safeJsonList } from "@/lib/format";

export default async function OrdersPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; payment?: string; deadline?: string }>;
}) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = resolvedSearchParams.q?.trim() ?? "";
  const statusFilter = resolvedSearchParams.status?.trim() ?? "";
  const paymentFilter = resolvedSearchParams.payment?.trim() ?? "";
  const deadlineFilter = resolvedSearchParams.deadline?.trim() ?? "";
  const statuses = safeJsonList(studio.settings?.workflowStatusesJson, [
    "Draft",
    "New",
    "Waiting for files",
    "Waiting for retouch",
    "In retouch",
    "Ready for review",
    "Ready for delivery",
    "Delivered",
    "Cancelled"
  ]);
  const paymentStatuses = ["Not paid", "Partly paid", "Paid", "Refunded"];
  const ordersBeforeDeadlineFilter = await prisma.order.findMany({
    where: {
      studioId: studio.id,
      status: statusFilter || undefined,
      paymentStatus: paymentFilter || undefined,
      OR: query
        ? [
            { orderNumber: { contains: query } },
            { customer: { name: { contains: query } } },
            { session: { sessionType: { contains: query } } }
          ]
        : undefined
    },
    orderBy: [{ deadline: "asc" }, { orderDate: "desc" }],
    include: { customer: true, session: true, items: true }
  });
  const orders = ordersBeforeDeadlineFilter.filter((order) => {
    if (!deadlineFilter) return true;
    const state = deadlineState(order.deadline);
    if (deadlineFilter === "overdue") return state === "overdue";
    if (deadlineFilter === "soon") return state === "soon";
    if (deadlineFilter === "none") return state === "none";
    return true;
  });
  const attentionCount = orders.filter((order) =>
    ["Waiting for files", "Waiting for retouch", "In retouch", "Ready for review", "Ready for delivery"].includes(order.status)
  ).length;
  const deadlineRiskCount = orders.filter((order) => ["overdue", "soon"].includes(deadlineState(order.deadline))).length;

  return (
    <AppShell>
      <PageHeader
        title="Orders"
        description="Selected images, products, retouch notes, deadlines, and production status."
        actions={<Button href="/orders/new" variant="primary">Create Order</Button>}
      />
      <section className="mb-4 rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-studio-ink">Order desk</h2>
            <p className="mt-1 text-sm text-slate-600">
              {attentionCount} visible orders need follow-up. {deadlineRiskCount} visible orders have deadline risk.
            </p>
          </div>
          <form className="grid gap-3 md:grid-cols-[1fr_190px_170px_170px_auto]">
            <input name="q" defaultValue={query} placeholder="Search orders or customers" />
            <select name="status" defaultValue={statusFilter}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <select name="payment" defaultValue={paymentFilter}>
              <option value="">All payments</option>
              {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <select name="deadline" defaultValue={deadlineFilter}>
              <option value="">All deadlines</option>
              <option value="overdue">Overdue</option>
              <option value="soon">Due soon</option>
              <option value="none">No deadline</option>
            </select>
            <Button type="submit" variant="primary">Filter</Button>
          </form>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-studio-line bg-white shadow-soft">
        <table className="w-full min-w-[1280px] text-sm">
          <thead className="bg-studio-paper text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Session</th>
              <th className="px-5 py-3">Items</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Payment</th>
              <th className="px-5 py-3">Deadline</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const activeItemCount = order.items.filter((item) => item.status !== "Cancelled" && item.status !== "Inactive").length;
              return (
                <tr key={order.id} className="border-t border-studio-line">
                  <td className="px-5 py-4 font-bold"><a href={`/orders/${order.id}`} className="text-studio-orangeDark hover:underline">{order.orderNumber}</a></td>
                  <td className="px-5 py-4">{order.customer.name}</td>
                  <td className="px-5 py-4">{order.session.sessionType}</td>
                  <td className="px-5 py-4">{activeItemCount}</td>
                  <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                  <td className="px-5 py-4"><StatusBadge status={order.paymentStatus} /></td>
                  <td className="px-5 py-4"><DeadlineBadge deadline={order.deadline} /></td>
                  <td className="px-5 py-4 font-bold">{formatMoney(order.totalPrice)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button href={`/orders/${order.id}`} className="min-h-9 px-3 py-2">View</Button>
                      <Button href={`/orders/${order.id}/edit`} className="min-h-9 px-3 py-2">Edit</Button>
                      <form action={updateOrderStatus.bind(null, order.id)} className="flex gap-2">
                        <select name="status" defaultValue={order.status} className="min-w-44">
                          {statuses.map((status) => <option key={status}>{status}</option>)}
                        </select>
                        <Button type="submit" className="min-h-9 px-3 py-2">Save</Button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">
                  No orders match the current filter. Clear the filters or create an order from a customer session.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
