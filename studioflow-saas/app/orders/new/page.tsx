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
    include: { customer: true }
  });

  return (
    <AppShell>
      <PageHeader title="Create Order" description="Start an order from an existing photo session." />
      <form action={createOrder} className="grid max-w-4xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <label>Session
          <select name="sessionId" required defaultValue={resolvedSearchParams.sessionId ?? ""}>
            <option value="">Choose session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {formatDate(session.date)} - {session.customer.name} - {session.sessionType}
              </option>
            ))}
          </select>
        </label>
        <label>Deadline<input type="date" name="deadline" /></label>
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
