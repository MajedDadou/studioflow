import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatMoney } from "@/lib/format";

export default async function ReportsPage() {
  const studio = await getActiveStudio();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [ordersThisMonth, completedOrders, pendingRetouch, urgentOrders, items, orders] = await Promise.all([
    prisma.order.count({ where: { studioId: studio.id, orderDate: { gte: monthStart } } }),
    prisma.order.count({ where: { studioId: studio.id, status: "Delivered" } }),
    prisma.retouchTask.count({ where: { studioId: studio.id, status: { notIn: ["Done", "Approved"] } } }),
    prisma.orderItem.count({ where: { urgent: true, order: { studioId: studio.id } } }),
    prisma.orderItem.findMany({ where: { order: { studioId: studio.id } }, include: { product: true } }),
    prisma.order.findMany({ where: { studioId: studio.id } })
  ]);

  const productCounts = new Map<string, number>();
  for (const item of items) productCounts.set(item.product.name, (productCounts.get(item.product.name) ?? 0) + item.quantity);
  const commonProducts = [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const revenuePlaceholder = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  const delivered = orders.filter((order) => order.status === "Delivered");
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
      <PageHeader title="Reports" description="Simple operational reporting for the MVP. Revenue is a placeholder until billing/payment is integrated." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Orders this month" value={ordersThisMonth} />
        <MetricCard label="Completed orders" value={completedOrders} />
        <MetricCard label="Pending retouch" value={pendingRetouch} />
        <MetricCard label="Average days to delivery" value={averageDays} />
        <MetricCard label="Urgent image items" value={urgentOrders} />
        <MetricCard label="Revenue placeholder" value={formatMoney(revenuePlaceholder)} />
      </div>
      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Most common products</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {commonProducts.map(([name, count]) => (
            <div key={name} className="rounded-xl bg-studio-paper p-4">
              <p className="font-bold text-studio-ink">{name}</p>
              <p className="mt-2 text-2xl font-black text-studio-orange">{count}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
