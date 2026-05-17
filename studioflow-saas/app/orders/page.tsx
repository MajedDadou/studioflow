import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { updateOrderStatus } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatMoney, safeJsonList } from "@/lib/format";

export default async function OrdersPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = resolvedSearchParams.q?.trim() ?? "";
  const statusFilter = resolvedSearchParams.status?.trim() ?? "";
  const statuses = safeJsonList(studio.settings?.workflowStatusesJson, []);
  const orders = await prisma.order.findMany({
    where: {
      studioId: studio.id,
      status: statusFilter || undefined,
      OR: query
        ? [
            { orderNumber: { contains: query } },
            { customer: { name: { contains: query } } },
            { session: { sessionType: { contains: query } } }
          ]
        : undefined
    },
    orderBy: { orderDate: "desc" },
    include: { customer: true, session: true, items: true }
  });
  const attentionCount = orders.filter((order) =>
    ["Waiting for files", "Waiting for retouch", "In retouch", "Ready for review", "Ready for delivery"].includes(order.status)
  ).length;

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
              {attentionCount} visible orders need an operational follow-up. Search by customer, order number, or session type.
            </p>
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
            <input name="q" defaultValue={query} placeholder="Search orders or customers" />
            <select name="status" defaultValue={statusFilter}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <Button type="submit" variant="primary">Filter</Button>
          </form>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-studio-line bg-white shadow-soft">
        <table className="w-full min-w-[1080px] text-sm">
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
              <th className="px-5 py-3">Change status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-studio-line">
                <td className="px-5 py-4 font-bold"><a href={`/orders/${order.id}`} className="text-studio-orangeDark hover:underline">{order.orderNumber}</a></td>
                <td className="px-5 py-4">{order.customer.name}</td>
                <td className="px-5 py-4">{order.session.sessionType}</td>
                <td className="px-5 py-4">{order.items.length}</td>
                <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                <td className="px-5 py-4"><StatusBadge status={order.paymentStatus} /></td>
                <td className="px-5 py-4"><DeadlineBadge deadline={order.deadline} /></td>
                <td className="px-5 py-4 font-bold">{formatMoney(order.totalPrice)}</td>
                <td className="px-5 py-4">
                  <form action={updateOrderStatus.bind(null, order.id)} className="flex gap-2">
                    <select name="status" defaultValue={order.status} className="min-w-44">
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <Button type="submit">Save</Button>
                  </form>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">
                  No orders match the current filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
