import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { updateOrderStatus } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney, safeJsonList } from "@/lib/format";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      studio: { include: { settings: true } },
      customer: true,
      session: true,
      items: {
        include: {
          product: true,
          frame: true,
          retouchTask: { include: { assignedRetoucher: true } }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!order) notFound();
  const statuses = safeJsonList(order.studio.settings?.workflowStatusesJson, []);
  const retouchItems = order.items.filter((item) => item.retouchType !== "None");
  const unassignedRetouch = retouchItems.filter((item) => !item.retouchTask?.assignedRetoucher).length;
  const urgentItems = order.items.filter((item) => item.urgent).length;
  const hasFolderPath = Boolean(order.session.folderPath.trim());
  const nextStep =
    order.items.length === 0
      ? "Add selected images before this can become a usable studio order."
      : unassignedRetouch > 0
        ? "Assign a retoucher before sending the handoff."
        : order.status === "Ready for delivery"
          ? "Contact the customer and mark the order as delivered when picked up or sent."
          : retouchItems.length > 0 && ["New", "Waiting for files"].includes(order.status)
            ? "Preview the retouch email and move the order to waiting for retouch."
            : "Review the folder plan and move the order to the next workflow status.";
  const checklist = [
    { label: "Customer connected", done: Boolean(order.customerId) },
    { label: "Session folder path present", done: hasFolderPath },
    { label: "Selected images added", done: order.items.length > 0 },
    { label: "Retouch tasks assigned", done: retouchItems.length === 0 || unassignedRetouch === 0 },
    { label: "Payment not refunded", done: order.paymentStatus !== "Refunded" }
  ];

  return (
    <AppShell>
      <PageHeader
        title={order.orderNumber}
        description={`${order.customer.name} - ${order.session.sessionType} - ${formatDate(order.orderDate)}`}
        actions={
          <>
            <Button href={`/orders/${order.id}/items/new`} variant="primary">Add one selected image</Button>
            <Button href={`/email-templates?orderId=${order.id}`}>Preview retouch email</Button>
            <Button href={`/local-bridge?orderId=${order.id}`}>Preview Folder Plan</Button>
          </>
        }
      />

      <section className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-studio-ink">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-black">Recommended next step</h2>
            <p className="mt-1 text-slate-700">{nextStep}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={updateOrderStatus.bind(null, order.id)}>
              <input type="hidden" name="status" value="Ready for delivery" />
              <Button type="submit">Mark as Ready</Button>
            </form>
            <form action={updateOrderStatus.bind(null, order.id)}>
              <input type="hidden" name="status" value="Delivered" />
              <Button type="submit" variant="primary">Mark as Delivered</Button>
            </form>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-4">
        <section className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Status</p>
          <div className="mt-3"><StatusBadge status={order.status} className="text-sm" /></div>
          <form action={updateOrderStatus.bind(null, order.id)} className="mt-4 grid gap-2">
            <select name="status" defaultValue={order.status}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <Button type="submit">Save status</Button>
          </form>
        </section>
        <section className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Deadline</p>
          <div className="mt-3"><DeadlineBadge deadline={order.deadline} /></div>
        </section>
        <section className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Payment</p>
          <div className="mt-3"><StatusBadge status={order.paymentStatus} /></div>
        </section>
        <section className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Total price</p>
          <p className="mt-3 text-3xl font-black text-studio-ink">{formatMoney(order.totalPrice)}</p>
        </section>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Operational checklist</h2>
          <div className="mt-4 grid gap-2">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl bg-studio-paper p-3 text-sm">
                <span className="font-bold text-studio-ink">{item.label}</span>
                <span className={item.done ? "font-black text-emerald-700" : "font-black text-red-700"}>
                  {item.done ? "OK" : "Needs attention"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Studio handoff summary</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            <p><span className="font-bold text-slate-500">Selected images:</span> {order.items.length}</p>
            <p><span className="font-bold text-slate-500">Retouch items:</span> {retouchItems.length}</p>
            <p><span className="font-bold text-slate-500">Unassigned retouch:</span> {unassignedRetouch}</p>
            <p><span className="font-bold text-slate-500">Urgent image items:</span> {urgentItems}</p>
            <p><span className="font-bold text-slate-500">Folder:</span> <span className="break-all">{order.session.folderPath || "Missing folder path"}</span></p>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-studio-line bg-white shadow-soft">
        <div className="border-b border-studio-line p-5">
          <h2 className="text-lg font-black text-studio-ink">Selected images and order items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-studio-paper text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Image</th>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">Frame</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">Variant</th>
                <th className="px-5 py-3">Retouch</th>
                <th className="px-5 py-3">Retoucher</th>
                <th className="px-5 py-3">Urgent</th>
                <th className="px-5 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-t border-studio-line">
                  <td className="px-5 py-4 font-bold">{item.imageRef}</td>
                  <td className="px-5 py-4">{item.product.name}<br /><span className="text-xs text-slate-500">{item.size}</span></td>
                  <td className="px-5 py-4">{item.frame?.name ?? "-"}</td>
                  <td className="px-5 py-4">{item.quantity}</td>
                  <td className="px-5 py-4">{item.variant}{item.blackAndWhite ? " - B/W" : ""}</td>
                  <td className="px-5 py-4">{item.retouchType}</td>
                  <td className="px-5 py-4">{item.retouchTask?.assignedRetoucher?.name ?? "-"}</td>
                  <td className="px-5 py-4">{item.urgent ? "Yes" : "No"}</td>
                  <td className="px-5 py-4 max-w-xs">{item.retouchNotes ?? "-"}</td>
                </tr>
              ))}
              {order.items.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">No selected images yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Order summary</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <p><span className="font-bold text-slate-500">Folder:</span> <span className="break-all">{order.session.folderPath}</span></p>
          <p><span className="font-bold text-slate-500">Photographer:</span> {order.session.photographer}</p>
          <p><span className="font-bold text-slate-500">Internal notes:</span> {order.internalNotes ?? "-"}</p>
          <p><span className="font-bold text-slate-500">Customer notes:</span> {order.customerNotes ?? "-"}</p>
        </div>
      </section>
    </AppShell>
  );
}
