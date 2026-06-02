import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { createOrder } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatDate } from "@/lib/format";

export default async function NewOrderPage({ searchParams }: { searchParams?: Promise<{ sessionId?: string }> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const sessions = await prisma.photoSession.findMany({
    where: { studioId: studio.id },
    orderBy: { date: "desc" },
    include: { customer: true, imageReferences: { select: { id: true } }, orders: { where: { studioId: studio.id }, select: { id: true } } }
  });
  const selectedSession = sessions.find((session) => session.id === resolvedSearchParams.sessionId);
  const paymentStatuses = ["Not paid", "Partly paid", "Paid", "Refunded"];

  return (
    <AppShell>
      <PageHeader title="Create Order" description="Start an order from an existing photo session." />
      {selectedSession ? (
        <section className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm text-studio-ink">
          <p className="font-black">Creating from session</p>
          <p className="mt-1 text-slate-700">
            {selectedSession.customer.name} - {selectedSession.sessionType} - {formatDate(selectedSession.date)}
          </p>
          <p className="mt-1 text-slate-700">
            {selectedSession.imageReferences.length} selected reference(s), {selectedSession.orders.length} existing order(s), folder:{" "}
            <span className="break-all font-semibold">{selectedSession.folderPath}</span>
          </p>
        </section>
      ) : null}
      <form action={createOrder} className="grid max-w-4xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Create a customer session before creating an order. Orders must be connected to a session and folder path.
          </div>
        ) : null}
        <label>Session
          <select name="sessionId" required defaultValue={selectedSession?.id ?? ""}>
            <option value="">Choose session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {formatDate(session.date)} - {session.customer.name} - {session.sessionType} - {session.imageReferences.length} selected
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
          Orders are connected to one session. After creating the order, add final products and retouch instructions from the order page.
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <label>Deadline<input type="date" name="deadline" /></label>
          <label>Payment status
            <select name="paymentStatus" defaultValue="Not paid" required>
              {paymentStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <label>Internal notes<textarea name="internalNotes" rows={4} placeholder="Production, retouch, or staff notes" /></label>
        <label>Customer notes<textarea name="customerNotes" rows={4} placeholder="Visible order context or customer wishes" /></label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Create Order</Button>
          <Button href="/orders">Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
