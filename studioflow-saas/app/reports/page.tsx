import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatDate, formatMoney } from "@/lib/format";

export default async function ReportsPage() {
  const studio = await getActiveStudio();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [
    ordersThisMonth,
    completedOrders,
    pendingRetouch,
    urgentOrderRows,
    items,
    orders,
    repeatCustomerCandidates,
    retouchQueue,
    urgentQueue
  ] = await Promise.all([
    prisma.order.count({ where: { studioId: studio.id, orderDate: { gte: monthStart } } }),
    prisma.order.count({ where: { studioId: studio.id, status: "Delivered" } }),
    prisma.retouchTask.count({ where: { studioId: studio.id, status: { notIn: ["Done", "Approved", "Cancelled"] } } }),
    prisma.order.findMany({
      where: {
        studioId: studio.id,
        status: { notIn: ["Delivered", "Cancelled"] },
        items: { some: { urgent: true, status: { notIn: ["Cancelled", "Inactive"] } } }
      },
      select: { id: true }
    }),
    prisma.orderItem.findMany({
      where: { status: { notIn: ["Cancelled", "Inactive"] }, order: { studioId: studio.id } },
      include: { product: true }
    }),
    prisma.order.findMany({
      where: { studioId: studio.id },
      include: { customer: true, items: true }
    }),
    prisma.customer.findMany({
      where: { studioId: studio.id },
      include: {
        _count: { select: { sessions: true, orders: true } },
        sessions: { orderBy: { date: "desc" }, take: 1, select: { date: true, sessionType: true } },
        orders: { orderBy: { orderDate: "desc" }, take: 1, select: { orderNumber: true, orderDate: true, status: true } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.retouchTask.findMany({
      where: { studioId: studio.id, status: { notIn: ["Done", "Approved", "Cancelled"] } },
      include: {
        assignedRetoucher: true,
        orderItem: { include: { order: { include: { customer: true } } } }
      },
      orderBy: [{ urgent: "desc" }, { deadline: "asc" }],
      take: 8
    }),
    prisma.order.findMany({
      where: {
        studioId: studio.id,
        status: { notIn: ["Delivered", "Cancelled"] },
        items: { some: { urgent: true, status: { notIn: ["Cancelled", "Inactive"] } } }
      },
      include: {
        customer: true,
        items: {
          where: { urgent: true, status: { notIn: ["Cancelled", "Inactive"] } },
          include: { product: true }
        }
      },
      orderBy: { deadline: "asc" },
      take: 8
    })
  ]);

  const productCounts = new Map<string, number>();
  for (const item of items) productCounts.set(item.product.name, (productCounts.get(item.product.name) ?? 0) + item.quantity);
  const commonProducts = [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const revenuePlaceholder = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  const delivered = orders.filter((order) => order.status === "Delivered");
  const statusCounts = [...orders.reduce((map, order) => map.set(order.status, (map.get(order.status) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);
  const repeatCustomers = repeatCustomerCandidates
    .filter((customer) => customer._count.sessions > 1 || customer._count.orders > 1)
    .slice(0, 10);
  const averageDays =
    delivered.length === 0
      ? 0
      : Math.round(
          delivered.reduce((sum, order) => {
            const diff = order.updatedAt.getTime() - order.orderDate.getTime();
            return sum + diff / (1000 * 60 * 60 * 24);
          }, 0) / delivered.length
        );

  return (
    <AppShell>
      <PageHeader
        title="Reports"
        description="Operational reporting for this studio. Revenue is still a placeholder until real payments are integrated."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Orders this month" value={ordersThisMonth} />
        <MetricCard label="Completed orders" value={completedOrders} />
        <MetricCard label="Pending retouch" value={pendingRetouch} />
        <MetricCard label="Average days to delivery" value={averageDays} />
        <MetricCard label="Urgent orders" value={urgentOrderRows.length} />
        <MetricCard label="Revenue placeholder" value={formatMoney(revenuePlaceholder)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Retouch queue</h2>
          <div className="mt-4 grid gap-3">
            {retouchQueue.map((task) => (
              <div key={task.id} className="rounded-xl bg-studio-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-studio-ink">{task.orderItem.imageRef}</p>
                    <p className="text-sm text-slate-600">
                      {task.orderItem.order.orderNumber} - {task.orderItem.order.customer.name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.urgent ? <StatusBadge status="Urgent" /> : null}
                    <StatusBadge status={task.status} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {task.assignedRetoucher?.name ?? "No retoucher"} - Deadline {formatDate(task.deadline)}
                </p>
                <p className="mt-2 text-sm text-slate-700">{task.notes ?? "No retouch notes."}</p>
              </div>
            ))}
            {retouchQueue.length === 0 ? (
              <p className="rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No pending retouch tasks.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Urgent orders</h2>
          <div className="mt-4 grid gap-3">
            {urgentQueue.map((order) => (
              <div key={order.id} className="rounded-xl bg-studio-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-studio-ink">{order.orderNumber}</p>
                    <p className="text-sm text-slate-600">{order.customer.name}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">Deadline {formatDate(order.deadline)}</p>
                <p className="mt-2 text-sm text-slate-700">
                  {order.items.length} urgent image item{order.items.length === 1 ? "" : "s"}.
                </p>
              </div>
            ))}
            {urgentQueue.length === 0 ? (
              <p className="rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No urgent active orders.</p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Most common products</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {commonProducts.map(([name, count]) => (
              <div key={name} className="rounded-xl bg-studio-paper p-4">
                <p className="font-bold text-studio-ink">{name}</p>
                <p className="mt-2 text-2xl font-black text-studio-orange">{count}</p>
              </div>
            ))}
            {commonProducts.length === 0 ? (
              <p className="rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No product usage yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Order status mix</h2>
          <div className="mt-4 grid gap-3">
            {statusCounts.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-xl bg-studio-paper p-4">
                <StatusBadge status={status} />
                <span className="text-2xl font-black text-studio-orange">{count}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-studio-ink">Customer repeat history</h2>
            <p className="mt-1 text-sm text-slate-600">Customers with multiple sessions or orders, useful for yearly family and school photo follow-up.</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-studio-line">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Sessions</th>
                <th>Orders</th>
                <th>Latest session</th>
                <th>Latest order</th>
              </tr>
            </thead>
            <tbody>
              {repeatCustomers.map((customer) => (
                <tr key={customer.id} className="border-t border-studio-line">
                  <td className="px-5 py-4">
                    <p className="font-bold text-studio-ink">{customer.name}</p>
                    <p className="text-sm text-slate-600">{customer.email ?? customer.phone ?? "No contact details"}</p>
                  </td>
                  <td className="px-5 py-4">{customer._count.sessions}</td>
                  <td className="px-5 py-4">{customer._count.orders}</td>
                  <td className="px-5 py-4">
                    {customer.sessions[0] ? `${formatDate(customer.sessions[0].date)} - ${customer.sessions[0].sessionType}` : "No session"}
                  </td>
                  <td className="px-5 py-4">
                    {customer.orders[0] ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{customer.orders[0].orderNumber}</span>
                        <StatusBadge status={customer.orders[0].status} />
                      </div>
                    ) : (
                      "No order"
                    )}
                  </td>
                </tr>
              ))}
              {repeatCustomers.length === 0 ? (
                <tr className="border-t border-studio-line">
                  <td colSpan={5} className="px-5 py-6 text-sm text-slate-600">
                    No repeat customers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
