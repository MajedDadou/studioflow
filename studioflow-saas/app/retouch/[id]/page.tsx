import { updateRetouchTaskStatus } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";

export default async function RetouchTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { record: task } = await requireStudioRecord((studioId) =>
    prisma.retouchTask.findFirst({
      where: { id, studioId },
      include: {
        assignedRetoucher: true,
        orderItem: {
          include: {
            product: true,
            frame: true,
            order: {
              include: {
                customer: true,
                session: true
              }
            }
          }
        }
      }
    })
  );
  const order = task.orderItem.order;
  const customer = order.customer;
  const returnTo = `/retouch/${task.id}`;

  return (
    <AppShell>
      <PageHeader
        title={`Retouch: ${task.orderItem.imageRef}`}
        description={`${customer.name} - ${order.orderNumber}`}
        actions={
          <>
            <Button href={`/retouch/${task.id}/edit`} variant="primary">Edit Task</Button>
            <Button href="/retouch">Back to Retouch</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} className="text-sm" />
            {task.urgent ? <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">Urgent</span> : null}
            <DeadlineBadge deadline={task.deadline} />
          </div>

          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm font-bold text-slate-500">Image reference</dt>
              <dd className="mt-1 text-xl font-black text-studio-ink">{task.orderItem.imageRef}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-slate-500">Assigned retoucher</dt>
              <dd className="mt-1 text-xl font-black text-studio-ink">{task.assignedRetoucher?.name ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-slate-500">Retouch type</dt>
              <dd className="mt-1 font-bold text-studio-ink">{task.retouchType}</dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-slate-500">Updated</dt>
              <dd className="mt-1 font-bold text-studio-ink">{formatDateTime(task.updatedAt)}</dd>
            </div>
          </dl>

          <div className="mt-6 rounded-xl bg-studio-paper p-4">
            <h2 className="font-black text-studio-ink">Retouch notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{task.notes ?? "No retouch notes."}</p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <form action={updateRetouchTaskStatus.bind(null, task.id)}>
              <input type="hidden" name="status" value="Needs changes" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="danger" className="w-full">Mark Needs Changes</Button>
            </form>
            <form action={updateRetouchTaskStatus.bind(null, task.id)}>
              <input type="hidden" name="status" value="Done" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="primary" className="w-full">Mark Done</Button>
            </form>
            <form action={updateRetouchTaskStatus.bind(null, task.id)}>
              <input type="hidden" name="status" value="Approved" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit" variant="primary" className="w-full">Mark Approved</Button>
            </form>
          </div>
        </section>

        <section className="grid gap-6">
          <article className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
            <h2 className="text-lg font-black text-studio-ink">Order context</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div><dt className="font-bold text-slate-500">Order</dt><dd><a className="font-black text-studio-orangeDark hover:underline" href={`/orders/${order.id}`}>{order.orderNumber}</a></dd></div>
              <div><dt className="font-bold text-slate-500">Customer</dt><dd>{customer.name}</dd></div>
              <div><dt className="font-bold text-slate-500">Phone</dt><dd>{customer.phone ?? "-"}</dd></div>
              <div><dt className="font-bold text-slate-500">Email</dt><dd>{customer.email ?? "-"}</dd></div>
              <div><dt className="font-bold text-slate-500">Session</dt><dd>{order.session.sessionType} with {order.session.photographer}</dd></div>
              <div><dt className="font-bold text-slate-500">Folder</dt><dd className="break-all">{order.session.folderPath}</dd></div>
            </dl>
          </article>

          <article className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
            <h2 className="text-lg font-black text-studio-ink">Selected item</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div><dt className="font-bold text-slate-500">Product</dt><dd>{task.orderItem.product.name}</dd></div>
              <div><dt className="font-bold text-slate-500">Size</dt><dd>{task.orderItem.size}</dd></div>
              <div><dt className="font-bold text-slate-500">Frame</dt><dd>{task.orderItem.frame?.name ?? "-"}</dd></div>
              <div><dt className="font-bold text-slate-500">Quantity</dt><dd>{task.orderItem.quantity}</dd></div>
              <div><dt className="font-bold text-slate-500">Variant</dt><dd>{task.orderItem.variant}</dd></div>
              <div><dt className="font-bold text-slate-500">Black and white</dt><dd>{task.orderItem.blackAndWhite ? "Yes" : "No"}</dd></div>
            </dl>
          </article>
        </section>
      </div>
    </AppShell>
  );
}
