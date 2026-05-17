import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { updateRetouchTaskStatus } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";

const statuses = ["Not started", "Sent to retoucher", "In progress", "Needs changes", "Done", "Approved"];

export default async function RetouchPage({ searchParams }: { searchParams?: Promise<{ retoucher?: string; urgent?: string }> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const retouchers = await prisma.retoucher.findMany({ where: { studioId: studio.id, active: true }, orderBy: { name: "asc" } });
  const tasks = await prisma.retouchTask.findMany({
    where: {
      studioId: studio.id,
      assignedRetoucherId: resolvedSearchParams.retoucher || undefined,
      urgent: resolvedSearchParams.urgent === "true" ? true : undefined
    },
    orderBy: [{ urgent: "desc" }, { deadline: "asc" }],
    include: {
      assignedRetoucher: true,
      orderItem: {
        include: {
          product: true,
          order: { include: { customer: true, session: true } }
        }
      }
    }
  });
  const urgentCount = tasks.filter((task) => task.urgent).length;
  const unassignedCount = tasks.filter((task) => !task.assignedRetoucher).length;

  return (
    <AppShell>
      <PageHeader
        title="Retouch Tasks"
        description="Assign tasks, filter by retoucher or urgency, and move retouch work through a simple status flow."
        actions={<Button href="/email-templates">Preview retouch email</Button>}
      />

      <section className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Visible retouch tasks</p>
          <p className="mt-2 text-3xl font-black text-studio-ink">{tasks.length}</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Urgent in this view</p>
          <p className="mt-2 text-3xl font-black text-red-700">{urgentCount}</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Unassigned</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{unassignedCount}</p>
        </div>
      </section>

      <form className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-studio-line bg-white p-4 shadow-soft">
        <select name="retoucher" defaultValue={resolvedSearchParams.retoucher ?? ""}>
          <option value="">All retouchers</option>
          {retouchers.map((retoucher) => <option key={retoucher.id} value={retoucher.id}>{retoucher.name}</option>)}
        </select>
        <select name="urgent" defaultValue={resolvedSearchParams.urgent ?? ""}>
          <option value="">All urgency</option>
          <option value="true">Urgent only</option>
        </select>
        <Button type="submit">Filter</Button>
      </form>

      <section className="grid gap-4">
        {tasks.map((task) => (
          <article key={task.id} className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/orders/${task.orderItem.order.id}`} className="text-lg font-black text-studio-orangeDark hover:underline">
                    {task.orderItem.order.orderNumber}
                  </a>
                  <StatusBadge status={task.status} />
                  {task.urgent ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">Urgent</span> : null}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {task.orderItem.order.customer.name} · {task.orderItem.imageRef} · {task.orderItem.product.name}
                </p>
                <p className="mt-2 text-sm text-slate-700">{task.notes ?? "No retouch notes"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DeadlineBadge deadline={task.deadline} />
                  <span className="rounded-full bg-studio-paper px-3 py-1 text-xs font-bold text-slate-700">
                    {task.assignedRetoucher?.name ?? "Unassigned"}
                  </span>
                </div>
              </div>
              <form action={updateRetouchTaskStatus.bind(null, task.id)} className="flex min-w-72 gap-2">
                <select name="status" defaultValue={task.status}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
                <Button type="submit">Save</Button>
              </form>
              <form action={updateRetouchTaskStatus.bind(null, task.id)}>
                <input type="hidden" name="status" value="Done" />
                <Button type="submit" variant="primary">Mark as Done</Button>
              </form>
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
