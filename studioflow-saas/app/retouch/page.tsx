import type { Prisma } from "@prisma/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { generateMissingRetouchTasks, updateRetouchTaskStatus } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { activeRetouchStatuses, retouchStatuses } from "@/lib/retouch";

type RetouchSearchParams = {
  retoucher?: string;
  status?: string;
  urgent?: string;
  deadline?: string;
};

function retouchDeadlineWhere(filter: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const sevenDays = new Date(now);
  sevenDays.setDate(now.getDate() + 7);

  if (filter === "overdue") return { lt: todayStart };
  if (filter === "today") return { gte: todayStart, lt: tomorrowStart };
  if (filter === "next7") return { lte: sevenDays };
  if (filter === "none") return null;
  return undefined;
}

function retouchNeededWhere(studioId: string): Prisma.OrderItemWhereInput {
  return {
    status: { notIn: ["Cancelled", "Inactive"] },
    order: { studioId },
    OR: [{ retouchType: { not: "None" } }, { retouchNotes: { not: null } }, { urgent: true }]
  };
}

export default async function RetouchPage({ searchParams }: { searchParams?: Promise<RetouchSearchParams> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const statusFilter = resolvedSearchParams.status?.trim() ?? "";
  const retoucherFilter = resolvedSearchParams.retoucher?.trim() ?? "";
  const urgentFilter = resolvedSearchParams.urgent?.trim() ?? "";
  const deadlineFilter = resolvedSearchParams.deadline?.trim() ?? "";
  const currentQuery = new URLSearchParams();
  if (retoucherFilter) currentQuery.set("retoucher", retoucherFilter);
  if (statusFilter) currentQuery.set("status", statusFilter);
  if (urgentFilter) currentQuery.set("urgent", urgentFilter);
  if (deadlineFilter) currentQuery.set("deadline", deadlineFilter);
  const currentPath = currentQuery.size ? `/retouch?${currentQuery.toString()}` : "/retouch";

  const taskWhere: Prisma.RetouchTaskWhereInput = {
    studioId: studio.id,
    assignedRetoucherId: retoucherFilter || undefined,
    urgent: urgentFilter === "true" ? true : urgentFilter === "false" ? false : undefined,
    status: statusFilter || { not: "Cancelled" }
  };
  const deadlineWhere = retouchDeadlineWhere(deadlineFilter);
  if (typeof deadlineWhere !== "undefined") {
    taskWhere.deadline = deadlineWhere;
  }

  const [
    retouchers,
    tasks,
    openCount,
    urgentOpenCount,
    overdueOpenCount,
    unassignedOpenCount,
    missingCandidates
  ] = await Promise.all([
    prisma.retoucher.findMany({ where: { studioId: studio.id, active: true }, orderBy: { name: "asc" } }),
    prisma.retouchTask.findMany({
      where: taskWhere,
      orderBy: [{ urgent: "desc" }, { deadline: "asc" }, { updatedAt: "desc" }],
      include: {
        assignedRetoucher: true,
        orderItem: {
          include: {
            product: true,
            frame: true,
            order: { include: { customer: true, session: true } }
          }
        }
      }
    }),
    prisma.retouchTask.count({ where: { studioId: studio.id, status: { in: activeRetouchStatuses } } }),
    prisma.retouchTask.count({ where: { studioId: studio.id, status: { in: activeRetouchStatuses }, urgent: true } }),
    prisma.retouchTask.count({
      where: {
        studioId: studio.id,
        status: { in: activeRetouchStatuses },
        deadline: { lt: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) }
      }
    }),
    prisma.retouchTask.count({
      where: { studioId: studio.id, status: { in: activeRetouchStatuses }, assignedRetoucherId: null }
    }),
    prisma.orderItem.findMany({
      where: retouchNeededWhere(studio.id),
      select: { id: true, retouchTask: { select: { id: true, status: true } } }
    })
  ]);
  const missingCount = missingCandidates.filter((item) => !item.retouchTask || item.retouchTask.status === "Cancelled").length;

  return (
    <AppShell>
      <PageHeader
        title="Retouch Tasks"
        description="Retouch work queue with assignment, deadlines, urgency, and status follow-up."
        actions={
          <>
            <form action={generateMissingRetouchTasks}>
              <input type="hidden" name="returnTo" value={currentPath} />
              <Button type="submit">Generate Missing Tasks</Button>
            </form>
            <Button href="/email-templates">Preview Retouch Email</Button>
          </>
        }
      />

      <section className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Open retouch tasks</p>
          <p className="mt-2 text-3xl font-black text-studio-ink">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Urgent open</p>
          <p className="mt-2 text-3xl font-black text-red-700">{urgentOpenCount}</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Overdue open</p>
          <p className="mt-2 text-3xl font-black text-red-700">{overdueOpenCount}</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Unassigned open</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{unassignedOpenCount}</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Missing task links</p>
          <p className="mt-2 text-3xl font-black text-studio-orangeDark">{missingCount}</p>
        </div>
      </section>

      {missingCount > 0 ? (
        <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-black">Some selected images have retouch instructions but no active task.</p>
              <p className="mt-1">Use Generate Missing Tasks to create or reopen task cards from the order items.</p>
            </div>
            <form action={generateMissingRetouchTasks}>
              <input type="hidden" name="returnTo" value={currentPath} />
              <Button type="submit" variant="primary">Generate Missing Tasks</Button>
            </form>
          </div>
        </section>
      ) : null}

      <form className="mb-4 grid gap-3 rounded-2xl border border-studio-line bg-white p-4 shadow-soft md:grid-cols-2 xl:grid-cols-5">
        <label>
          Retoucher
          <select name="retoucher" defaultValue={retoucherFilter}>
            <option value="">All retouchers</option>
            {retouchers.map((retoucher) => <option key={retoucher.id} value={retoucher.id}>{retoucher.name}</option>)}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={statusFilter}>
            <option value="">All active statuses</option>
            {retouchStatuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
        <label>
          Urgency
          <select name="urgent" defaultValue={urgentFilter}>
            <option value="">All urgency</option>
            <option value="true">Urgent only</option>
            <option value="false">Not urgent</option>
          </select>
        </label>
        <label>
          Deadline
          <select name="deadline" defaultValue={deadlineFilter}>
            <option value="">All deadlines</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="next7">Due within 7 days</option>
            <option value="none">No deadline</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="primary">Filter</Button>
          <Button href="/retouch">Clear</Button>
        </div>
      </form>

      <section className="grid gap-4">
        {tasks.map((task) => (
          <article key={task.id} className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
            <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/retouch/${task.id}`} className="text-lg font-black text-studio-orangeDark hover:underline">
                    {task.orderItem.imageRef}
                  </a>
                  <StatusBadge status={task.status} />
                  {task.urgent ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Urgent</span> : null}
                </div>
                <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                  <p><span className="font-bold text-slate-500">Customer:</span> {task.orderItem.order.customer.name}</p>
                  <p><span className="font-bold text-slate-500">Order:</span> {task.orderItem.order.orderNumber}</p>
                  <p><span className="font-bold text-slate-500">Retoucher:</span> {task.assignedRetoucher?.name ?? "Unassigned"}</p>
                  <p><span className="font-bold text-slate-500">Type:</span> {task.retouchType}</p>
                </div>
                <p className="mt-3 text-sm text-slate-700">{task.notes ?? "No retouch notes"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DeadlineBadge deadline={task.deadline} />
                  <span className="rounded-full bg-studio-paper px-3 py-1 text-xs font-bold text-slate-700">
                    {task.orderItem.product.name}
                    {task.orderItem.frame ? ` - ${task.orderItem.frame.name}` : ""}
                  </span>
                  <a href={`/orders/${task.orderItem.order.id}`} className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-studio-orangeDark hover:underline">
                    Open order
                  </a>
                </div>
              </div>
              <div className="grid content-start gap-2 sm:grid-cols-2 xl:min-w-96">
                <form action={updateRetouchTaskStatus.bind(null, task.id)} className="flex gap-2 sm:col-span-2">
                  <input type="hidden" name="returnTo" value={currentPath} />
                  <select name="status" defaultValue={task.status}>
                    {retouchStatuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                  <Button type="submit">Save</Button>
                </form>
                <Button href={`/retouch/${task.id}`}>Details</Button>
                <Button href={`/retouch/${task.id}/edit`}>Edit</Button>
                <form action={updateRetouchTaskStatus.bind(null, task.id)}>
                  <input type="hidden" name="status" value="Needs changes" />
                  <input type="hidden" name="returnTo" value={currentPath} />
                  <Button type="submit" variant="danger" className="w-full">Needs Changes</Button>
                </form>
                <form action={updateRetouchTaskStatus.bind(null, task.id)}>
                  <input type="hidden" name="status" value="Done" />
                  <input type="hidden" name="returnTo" value={currentPath} />
                  <Button type="submit" variant="primary" className="w-full">Mark Done</Button>
                </form>
                <form action={updateRetouchTaskStatus.bind(null, task.id)} className="sm:col-span-2">
                  <input type="hidden" name="status" value="Approved" />
                  <input type="hidden" name="returnTo" value={currentPath} />
                  <Button type="submit" variant="primary" className="w-full">Mark Approved</Button>
                </form>
              </div>
            </div>
          </article>
        ))}
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-studio-line bg-white p-10 text-center font-semibold text-slate-500 shadow-soft">
            No retouch tasks match the current filter.
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
