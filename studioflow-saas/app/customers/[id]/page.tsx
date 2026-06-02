import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";
import { formatDate, formatMoney } from "@/lib/format";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { record: customer } = await requireStudioRecord((studioId) =>
    prisma.customer.findFirst({
      where: { id, studioId },
      include: {
        sessions: { where: { studioId }, orderBy: { date: "desc" } },
        orders: { where: { studioId }, orderBy: { orderDate: "desc" }, include: { session: true } }
      }
    })
  );

  return (
    <AppShell>
      <PageHeader
        title={customer.name}
        description="Customer profile with connected sessions and orders."
        actions={
          <>
            <Button href={`/sessions/new?customerId=${customer.id}`} variant="primary">New Session</Button>
            <Button href={`/customers/${customer.id}/edit`}>Edit Customer</Button>
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Contact</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="font-bold text-slate-500">Phone</dt><dd>{customer.phone ?? "-"}</dd></div>
            <div><dt className="font-bold text-slate-500">Email</dt><dd>{customer.email ?? "-"}</dd></div>
            <div><dt className="font-bold text-slate-500">Created</dt><dd>{formatDate(customer.createdAt)}</dd></div>
            <div><dt className="font-bold text-slate-500">Notes</dt><dd>{customer.notes ?? "No notes"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-studio-ink">Connected orders</h2>
            <Button href="/orders/new">Create Order</Button>
          </div>
          <div className="mt-4 grid gap-3">
            {customer.orders.map((order) => (
              <a key={order.id} href={`/orders/${order.id}`} className="rounded-xl border border-studio-line p-4 transition hover:border-studio-orange">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-black text-studio-ink">{order.orderNumber}</p>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {order.session.sessionType} - {formatDate(order.orderDate)} - {formatMoney(order.totalPrice)}
                </p>
              </a>
            ))}
            {customer.orders.length === 0 ? (
              <div className="rounded-xl bg-studio-paper p-4 text-sm font-semibold text-slate-500">
                No orders yet. Create a session first, then create an order from that session.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-studio-ink">Session timeline</h2>
          <Button href={`/sessions/new?customerId=${customer.id}`}>Add Session</Button>
        </div>
        <div className="mt-4 grid gap-3">
          {customer.sessions.map((session) => (
            <a key={session.id} href={`/sessions/${session.id}`} className="rounded-xl bg-studio-paper p-4">
              <p className="font-bold text-studio-ink">{formatDate(session.date)} - {session.sessionType}</p>
              <p className="break-all text-sm text-slate-600">{session.photographer} - {session.folderPath}</p>
            </a>
          ))}
          {customer.sessions.length === 0 ? (
            <div className="rounded-xl bg-studio-paper p-4 text-sm font-semibold text-slate-500">
              No sessions yet. Start by creating the customer shoot and connecting it to a folder path.
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
