import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";
import { formatDate, formatMoney } from "@/lib/format";

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { record: session } = await requireStudioRecord((studioId) =>
    prisma.photoSession.findFirst({
      where: { id, studioId },
      include: {
        customer: true,
        imageReferences: { orderBy: { createdAt: "asc" } },
        orders: {
          where: { studioId },
          include: { items: { include: { product: true } } },
          orderBy: { orderDate: "desc" }
        }
      }
    })
  );

  return (
    <AppShell>
      <PageHeader
        title={`${session.sessionType} - ${session.customer.name}`}
        description="Session timeline, connected orders, selected images, and folder reference."
        actions={
          <>
            <Button href={`/orders/new?sessionId=${session.id}`} variant="primary">Create Order</Button>
            <Button href={`/sessions/${session.id}/edit`}>Edit Session</Button>
          </>
        }
      />

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Selected references</p>
          <p className="mt-2 text-3xl font-black text-studio-ink">{session.imageReferences.length}</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Connected orders</p>
          <p className="mt-2 text-3xl font-black text-studio-ink">{session.orders.length}</p>
        </div>
        <div className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <p className="text-sm font-bold text-slate-500">Folder reference</p>
          <p className={session.folderPath ? "mt-2 font-black text-emerald-700" : "mt-2 font-black text-red-700"}>
            {session.folderPath ? "Ready" : "Missing"}
          </p>
        </div>
      </section>

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
                  {order.items.length} selected images - {formatMoney(order.totalPrice)}
                </p>
              </a>
            ))}
            {session.orders.length === 0 ? (
              <div className="rounded-xl bg-studio-paper p-4 text-sm font-semibold text-slate-500">
                No order has been created from this session yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-studio-ink">Selected image references</h2>
            <p className="mt-1 text-sm text-slate-600">References captured during the customer selection. These are text references only.</p>
          </div>
          <Button href={`/sessions/${session.id}/edit`}>Edit references</Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {session.imageReferences.map((reference) => (
            <div key={reference.id} className="rounded-xl bg-studio-paper p-3 font-mono text-sm font-bold text-studio-ink">
              {reference.imageRef}
            </div>
          ))}
          {session.imageReferences.length === 0 ? (
            <div className="rounded-xl bg-studio-paper p-4 text-sm font-semibold text-slate-500">
              No selected images are stored on this session yet. Add them from Edit Session.
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
