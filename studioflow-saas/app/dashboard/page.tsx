import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { deadlineState, formatDateTime, formatMoney, safeJsonList } from "@/lib/format";

export default async function DashboardPage() {
  const studio = await getActiveStudio();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const urgentLimit = new Date(now);
  urgentLimit.setDate(now.getDate() + 3);

  const [
    todaySessions,
    todaySessionList,
    activeOrders,
    waitingRetouch,
    urgentOrders,
    completedThisWeek,
    activities,
    recentOrders,
    actionOrders,
    retouchTasks,
    productsCount,
    retouchersCount,
    emailTemplatesCount,
    customersCount,
    orderItemsCount
  ] =
    await Promise.all([
      prisma.photoSession.count({ where: { studioId: studio.id, date: { gte: todayStart, lt: todayEnd } } }),
      prisma.photoSession.findMany({
        where: { studioId: studio.id, date: { gte: todayStart, lt: todayEnd } },
        orderBy: { date: "asc" },
        include: { customer: true, orders: true }
      }),
      prisma.order.count({ where: { studioId: studio.id, status: { notIn: ["Delivered", "Cancelled"] } } }),
      prisma.order.count({ where: { studioId: studio.id, status: { in: ["Waiting for retouch", "In retouch"] } } }),
      prisma.order.count({
        where: {
          studioId: studio.id,
          status: { notIn: ["Delivered", "Cancelled"] },
          deadline: { lte: urgentLimit }
        }
      }),
      prisma.order.count({ where: { studioId: studio.id, status: "Delivered", updatedAt: { gte: weekStart } } }),
      prisma.activity.findMany({ where: { studioId: studio.id }, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.order.findMany({
        where: { studioId: studio.id, status: { notIn: ["Delivered", "Cancelled"] } },
        orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
        take: 7,
        include: { customer: true, session: true }
      }),
      prisma.order.findMany({
        where: {
          studioId: studio.id,
          status: { in: ["Waiting for files", "Waiting for retouch", "In retouch", "Ready for review", "Ready for delivery"] }
        },
        orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
        take: 6,
        include: { customer: true, session: true, items: true }
      }),
      prisma.retouchTask.findMany({
        where: { studioId: studio.id, status: { notIn: ["Done", "Approved"] } },
        orderBy: [{ urgent: "desc" }, { deadline: "asc" }],
        take: 5,
        include: {
          assignedRetoucher: true,
          orderItem: { include: { order: { include: { customer: true } } } }
        }
      }),
      prisma.product.count({ where: { studioId: studio.id, active: true } }),
      prisma.retoucher.count({ where: { studioId: studio.id, active: true } }),
      prisma.emailTemplate.count({ where: { studioId: studio.id, active: true } }),
      prisma.customer.count({ where: { studioId: studio.id } }),
      prisma.orderItem.count({ where: { order: { studioId: studio.id } } })
    ]);

  const placeholderRevenue = recentOrders.reduce((sum, order) => sum + order.totalPrice, 0);
  const workflowStatusCount = safeJsonList(studio.settings?.workflowStatusesJson).length;
  const retouchTypeCount = safeJsonList(studio.settings?.retouchTypesJson).length;
  const photographerCount = safeJsonList(studio.settings?.photographersJson).length;
  const readinessItems = [
    { label: "Products configured", done: productsCount > 0, detail: `${productsCount} active` },
    { label: "Retouchers configured", done: retouchersCount > 0, detail: `${retouchersCount} active` },
    { label: "Email templates ready", done: emailTemplatesCount > 0, detail: `${emailTemplatesCount} active` },
    { label: "Workflow statuses configured", done: workflowStatusCount >= 4, detail: `${workflowStatusCount} statuses` },
    { label: "Photographers configured", done: photographerCount > 0, detail: `${photographerCount} people` },
    { label: "Retouch types configured", done: retouchTypeCount > 0, detail: `${retouchTypeCount} types` },
    { label: "Demo/customer data available", done: customersCount > 0 && orderItemsCount > 0, detail: `${customersCount} customers, ${orderItemsCount} image items` },
    { label: "Bridge safety mode", done: true, detail: "Dry-run and safe test folder only" }
  ];
  const readinessDone = readinessItems.filter((item) => item.done).length;

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description={`Operational overview for ${studio.name}. Deadlines, retouch load, and order status are visible at a glance.`}
        actions={<Button href="/sessions/new" variant="primary">New Session</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Today's sessions" value={todaySessions} detail="Booked or imported today" />
        <MetricCard label="Active orders" value={activeOrders} detail="Not delivered or cancelled" />
        <MetricCard label="Waiting for retouch" value={waitingRetouch} detail="Needs retouch attention" />
        <MetricCard label="Urgent orders" value={urgentOrders} detail="Due within 3 days or overdue" />
        <MetricCard label="Completed this week" value={completedThisWeek} detail="Delivered orders" />
        <MetricCard label="Revenue placeholder" value={formatMoney(placeholderRevenue)} detail="From recent demo orders" />
      </div>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-studio-ink">MVP readiness</h2>
            <p className="mt-1 text-sm text-slate-600">A quick setup check before a studio owner tests the workflow.</p>
          </div>
          <div className="rounded-full bg-orange-50 px-4 py-2 text-sm font-black text-studio-orangeDark">
            {readinessDone}/{readinessItems.length} ready
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {readinessItems.map((item) => (
            <div key={item.label} className="flex items-start gap-3 rounded-xl bg-studio-paper p-3 text-sm">
              <span className={item.done ? "mt-0.5 font-black text-emerald-700" : "mt-0.5 font-black text-red-700"}>
                {item.done ? "OK" : "Fix"}
              </span>
              <div>
                <p className="font-bold text-studio-ink">{item.label}</p>
                <p className="text-slate-500">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-studio-ink">Today's studio desk</h2>
            <p className="mt-1 text-sm text-slate-600">The first screen staff should check before handling customers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button href="/customers/new">New Customer</Button>
            <Button href="/orders/new">Create Order</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-xl bg-studio-paper p-4">
            <h3 className="font-black text-studio-ink">Sessions today</h3>
            <div className="mt-3 grid gap-2">
              {todaySessionList.map((session) => (
                <a key={session.id} href={`/sessions/${session.id}`} className="rounded-xl bg-white p-3 text-sm transition hover:ring-2 hover:ring-orange-100">
                  <span className="font-bold text-studio-ink">{session.customer.name}</span>
                  <span className="text-slate-600"> - {session.sessionType} with {session.photographer}</span>
                </a>
              ))}
              {todaySessionList.length === 0 ? <p className="text-sm font-semibold text-slate-500">No sessions today.</p> : null}
            </div>
          </div>
          <div className="rounded-xl bg-studio-paper p-4">
            <h3 className="font-black text-studio-ink">Needs attention</h3>
            <div className="mt-3 grid gap-2">
              {actionOrders.map((order) => {
                const state = deadlineState(order.deadline);
                const reason =
                  order.status === "Waiting for files"
                    ? "Missing files or folder handoff"
                    : order.status === "Waiting for retouch" || order.status === "In retouch"
                      ? "Retouch handoff needs follow-up"
                      : order.status === "Ready for delivery"
                        ? "Customer can be contacted"
                        : "Review before next step";
                return (
                  <a key={order.id} href={`/orders/${order.id}`} className="rounded-xl bg-white p-3 text-sm transition hover:ring-2 hover:ring-orange-100">
                    <span className="font-bold text-studio-ink">{order.orderNumber}</span>
                    <span className="text-slate-600"> - {order.customer.name} - {reason}</span>
                    {state === "overdue" || state === "soon" ? <span className="ml-2 font-bold text-red-700">Deadline risk</span> : null}
                  </a>
                );
              })}
              {actionOrders.length === 0 ? <p className="text-sm font-semibold text-slate-500">No urgent operational follow-up.</p> : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-studio-line bg-white shadow-soft">
          <div className="border-b border-studio-line p-5">
            <h2 className="text-lg font-black text-studio-ink">Deadline warnings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-studio-paper text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Session</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Deadline</th>
                  <th className="px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-studio-line">
                    <td className="px-5 py-4 font-bold">
                      <a className="text-studio-orangeDark hover:underline" href={`/orders/${order.id}`}>
                        {order.orderNumber}
                      </a>
                    </td>
                    <td className="px-5 py-4">{order.customer.name}</td>
                    <td className="px-5 py-4">{order.session.sessionType}</td>
                    <td className="px-5 py-4"><StatusBadge status={order.status} /></td>
                    <td className="px-5 py-4"><DeadlineBadge deadline={order.deadline} /></td>
                    <td className="px-5 py-4 font-bold">{formatMoney(order.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Retouch load</h2>
          <div className="mt-4 grid gap-3">
            {retouchTasks.map((task) => (
              <a key={task.id} href={`/orders/${task.orderItem.order.id}`} className="rounded-xl bg-studio-paper p-4 transition hover:ring-2 hover:ring-orange-100">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-studio-ink">{task.orderItem.imageRef}</p>
                  {task.urgent ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">Urgent</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">{task.orderItem.order.customer.name} - {task.assignedRetoucher?.name ?? "Unassigned"}</p>
                <div className="mt-2"><DeadlineBadge deadline={task.deadline} /></div>
              </a>
            ))}
            {retouchTasks.length === 0 ? <p className="text-sm font-semibold text-slate-500">No pending retouch tasks.</p> : null}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Recent activity</h2>
          <div className="mt-4 grid gap-3">
            {activities.map((activity) => (
              <div key={activity.id} className="rounded-xl bg-studio-paper p-4">
                <p className="text-sm font-bold text-studio-ink">{activity.message}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(activity.createdAt)}</p>
              </div>
            ))}
          </div>
      </section>
    </AppShell>
  );
}
