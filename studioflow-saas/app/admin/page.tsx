import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime, formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireFounderAdmin } from "@/lib/studio";

function increment(map: Map<string, number>, key: string | null | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function auditMetadata(value: string | null) {
  if (!value) return "";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default async function AdminPage() {
  await requireFounderAdmin();

  const [
    studios,
    users,
    memberships,
    subscriptions,
    bridgeAgents,
    failedBridgeJobs,
    emailLogs,
    recentActivities,
    recentAuditLogs,
    orders,
    invoices
  ] = await Promise.all([
    prisma.studio.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { customers: true, members: true, orders: true } }
      }
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { memberships: { include: { studio: true, role: true } } }
    }),
    prisma.studioMember.findMany({
      include: { user: true, studio: true, role: true },
      orderBy: { createdAt: "desc" }
    }),
    prisma.studioSubscription.findMany({
      include: { studio: true, plan: true },
      orderBy: { startedAt: "desc" }
    }),
    prisma.bridgeAgent.findMany({ orderBy: { updatedAt: "desc" }, include: { studio: true } }),
    prisma.bridgeJob.findMany({
      where: { status: { in: ["Failed", "Blocked"] } },
      include: { studio: true, order: true, logs: true },
      orderBy: { updatedAt: "desc" },
      take: 20
    }),
    prisma.emailLog.findMany({
      where: { status: { in: ["Failed", "Prepared"] } },
      include: { studio: true, order: true, template: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.activity.findMany({
      include: { studio: true },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.auditLog.findMany({
      include: { studio: true, user: true },
      orderBy: { createdAt: "desc" },
      take: 30
    }),
    prisma.order.findMany({ select: { studioId: true, totalPrice: true, status: true } }),
    prisma.invoice.findMany({ select: { studioId: true, amount: true, status: true } })
  ]);

  const activeBridgeAgents = bridgeAgents.filter((agent) => agent.status === "Online");
  const preparedEmails = emailLogs.filter((log) => log.status === "Prepared");
  const failedEmails = emailLogs.filter((log) => log.status === "Failed");
  const orderRevenue = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  const invoiceRevenue = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const activeBridgeAgentsByStudio = new Map<string, number>();
  const failedJobsByStudio = new Map<string, number>();
  const preparedEmailsByStudio = new Map<string, number>();
  const failedEmailsByStudio = new Map<string, number>();

  for (const agent of activeBridgeAgents) increment(activeBridgeAgentsByStudio, agent.studioId);
  for (const job of failedBridgeJobs) increment(failedJobsByStudio, job.studioId);
  for (const log of preparedEmails) increment(preparedEmailsByStudio, log.studioId);
  for (const log of failedEmails) increment(failedEmailsByStudio, log.studioId);

  return (
    <AppShell>
      <PageHeader
        title="Owner Admin"
        description="Internal StudioFlow owner overview across all studios. Protected by the local founder-admin allowlist."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Studios" value={studios.length} />
        <MetricCard label="Users" value={users.length} />
        <MetricCard label="Memberships" value={memberships.length} />
        <MetricCard label="Active bridge agents" value={activeBridgeAgents.length} />
        <MetricCard label="Failed bridge jobs" value={failedBridgeJobs.length} />
        <MetricCard label="Prepared/failed emails" value={`${preparedEmails.length}/${failedEmails.length}`} />
      </div>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">All studios</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-studio-line">
          <table>
            <thead>
              <tr>
                <th>Studio</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Users</th>
                <th>Customers</th>
                <th>Orders</th>
                <th>Active bridge</th>
                <th>Failed jobs</th>
                <th>Email issues</th>
              </tr>
            </thead>
            <tbody>
              {studios.map((studio) => (
                <tr key={studio.id} className="border-t border-studio-line">
                  <td className="px-5 py-4">
                    <p className="font-bold text-studio-ink">{studio.name}</p>
                    <p className="text-xs text-slate-500">{studio.slug}</p>
                  </td>
                  <td className="px-5 py-4">{studio.subscription?.plan.name ?? "No plan"}</td>
                  <td className="px-5 py-4"><StatusBadge status={studio.subscription?.status ?? "Not configured"} /></td>
                  <td className="px-5 py-4">{studio._count.members}</td>
                  <td className="px-5 py-4">{studio._count.customers}</td>
                  <td className="px-5 py-4">{studio._count.orders}</td>
                  <td className="px-5 py-4">{activeBridgeAgentsByStudio.get(studio.id) ?? 0}</td>
                  <td className="px-5 py-4">{failedJobsByStudio.get(studio.id) ?? 0}</td>
                  <td className="px-5 py-4">
                    {(preparedEmailsByStudio.get(studio.id) ?? 0) + (failedEmailsByStudio.get(studio.id) ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Subscriptions</h2>
          <div className="mt-4 grid gap-3">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="rounded-xl bg-studio-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-studio-ink">{subscription.studio.name}</p>
                    <p className="text-sm text-slate-600">{subscription.plan.name} - {formatMoney(subscription.plan.priceDkk * 100)} / month</p>
                  </div>
                  <StatusBadge status={subscription.status} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Users and memberships</h2>
          <div className="mt-4 grid gap-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-xl bg-studio-paper p-4">
                <p className="font-bold text-studio-ink">{user.name}</p>
                <p className="break-all text-sm text-slate-600">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {user.memberships.map((membership) => (
                    <span key={membership.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                      {membership.studio.name} / {membership.role.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Failed bridge jobs</h2>
          <div className="mt-4 grid gap-3">
            {failedBridgeJobs.map((job) => (
              <div key={job.id} className="rounded-xl bg-studio-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-studio-ink">{job.studio.name} / {job.type}</p>
                  <StatusBadge status={job.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{job.order?.orderNumber ?? "No order"} - {formatDateTime(job.updatedAt)}</p>
                <p className="mt-2 text-sm text-slate-600">{job.logs[0]?.message ?? "No bridge log message."}</p>
              </div>
            ))}
            {failedBridgeJobs.length === 0 ? <p className="rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No failed or blocked bridge jobs.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Failed/prepared emails</h2>
          <div className="mt-4 grid gap-3">
            {emailLogs.map((log) => (
              <div key={log.id} className="rounded-xl bg-studio-paper p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold text-studio-ink">{log.studio.name} / {log.template?.name ?? "Email"}</p>
                  <StatusBadge status={log.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{log.order?.orderNumber ?? "No order"} - {log.subject}</p>
              </div>
            ))}
            {emailLogs.length === 0 ? <p className="rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No prepared or failed emails.</p> : null}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Recent activity</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recentActivities.map((activity) => (
            <div key={activity.id} className="rounded-xl bg-studio-paper p-4">
              <p className="font-bold text-studio-ink">{activity.studio.name}</p>
              <p className="mt-1 text-sm text-slate-700">{activity.message}</p>
              <p className="mt-2 text-xs text-slate-500">{formatDateTime(activity.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-studio-ink">Recent audit logs</h2>
            <p className="mt-1 text-sm text-slate-600">Cross-studio audit trail for owner support and private beta debugging.</p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p>Order revenue placeholder: {formatMoney(orderRevenue)}</p>
            <p>Invoice total: {formatMoney(invoiceRevenue)}</p>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-studio-line">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Studio</th>
                <th>User</th>
                <th>Entity</th>
                <th>Metadata</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentAuditLogs.map((log) => (
                <tr key={log.id} className="border-t border-studio-line align-top">
                  <td className="px-5 py-4 font-bold text-studio-ink">{log.action}</td>
                  <td className="px-5 py-4">{log.studio.name}</td>
                  <td className="px-5 py-4">{log.user?.name ?? "System"}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{log.entityType}<br />{log.entityId ?? "-"}</td>
                  <td className="max-w-sm px-5 py-4">
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{auditMetadata(log.metadataJson)}</pre>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
