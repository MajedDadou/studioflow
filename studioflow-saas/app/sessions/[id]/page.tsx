import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMoney } from "@/lib/format";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.photoSession.findUnique({
    where: { id },
    include: {
      customer: true,
      orders: {
        include: { items: { include: { product: true } } },
        orderBy: { orderDate: "desc" }
      }
    }
  });
  if (!session) notFound();

  return (
    <AppShell>
      <PageHeader
        title={`${session.sessionType} - ${session.customer.name}`}
        description="Session timeline, connected orders, selected images, and folder reference."
        actions={<Button href={`/orders/new?sessionId=${session.id}`} variant="primary">Create Order</Button>}
      />
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Session details</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="font-bold text-slate-500">Customer</dt><dd>{session.customer.name}</dd></div>
            <div><dt className="font-bold text-slate-500">Date</dt><dd>{formatDate(session.date)}</dd></div>
            <div><dt className="font-bold text-slate-500">Photographer</dt><dd>{session.photographer}</dd></div>
            <div><dt className="font-bold text-slate-500">Status</dt><dd><StatusBadge status={session.status} /></dd></div>
            <div><dt className="font-bold text-slate-500">Folder</dt><dd className="break-all">{session.folderPath}</dd></div>
            <div><dt className="font-bold text-slate-500">Notes</dt><dd>{session.notes ?? "No notes"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Session timeline</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl bg-studio-paper p-4">
              <p className="font-bold text-studio-ink">Session created</p>
              <p className="text-sm text-slate-600">{formatDate(session.createdAt)}</p>
            </div>
            {session.orders.map((order) => (
              <a key={order.id} href={`/orders/${order.id}`} className="rounded-xl border border-studio-line p-4 transition hover:border-studio-orange">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-black text-studio-ink">Order {order.orderNumber}</p>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {order.items.length} selected images · {formatMoney(order.totalPrice)}
                </p>
              </a>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
