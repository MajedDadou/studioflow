import { updateOrder } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";
import { formatDate, formatMoney, safeJsonList } from "@/lib/format";

const paymentStatuses = ["Not paid", "Partly paid", "Paid", "Refunded"];

function dateInputValue(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studio, record: order } = await requireStudioRecord((studioId) =>
    prisma.order.findFirst({
      where: { id, studioId },
      include: {
        customer: true,
        session: true,
        items: { where: { status: { notIn: ["Cancelled", "Inactive"] } } }
      }
    })
  );
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

  return (
    <AppShell>
      <PageHeader
        title={`Edit ${order.orderNumber}`}
        description={`Update status, deadline, payment, and notes for ${order.customer.name}.`}
      />
      <form action={updateOrder.bind(null, order.id)} className="grid max-w-5xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="grid gap-4 rounded-xl bg-studio-paper p-4 text-sm md:grid-cols-3">
          <div>
            <p className="font-bold text-slate-500">Customer</p>
            <p className="mt-1 font-black text-studio-ink">{order.customer.name}</p>
          </div>
          <div>
            <p className="font-bold text-slate-500">Session</p>
            <p className="mt-1 font-black text-studio-ink">{formatDate(order.session.date)} - {order.session.sessionType}</p>
          </div>
          <div>
            <p className="font-bold text-slate-500">Current total</p>
            <p className="mt-1 font-black text-studio-ink">{formatMoney(order.totalPrice)} / {order.items.length} active item(s)</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <label>Status
            <select name="status" required defaultValue={order.status}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>Payment status
            <select name="paymentStatus" required defaultValue={order.paymentStatus}>
              {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>Deadline<input name="deadline" type="date" defaultValue={dateInputValue(order.deadline)} /></label>
        </div>

        <label>Internal notes
          <textarea name="internalNotes" rows={5} defaultValue={order.internalNotes ?? ""} placeholder="Production, retouch, or staff notes" />
        </label>
        <label>Customer notes
          <textarea name="customerNotes" rows={5} defaultValue={order.customerNotes ?? ""} placeholder="Customer wishes, delivery context, or agreements" />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">Save Order</Button>
          <Button href={`/orders/${order.id}`}>Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
