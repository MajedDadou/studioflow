import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatDate } from "@/lib/format";

export default async function SessionsPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = resolvedSearchParams.q?.trim() ?? "";
  const statusFilter = resolvedSearchParams.status?.trim() ?? "";
  const sessions = await prisma.photoSession.findMany({
    where: {
      studioId: studio.id,
      status: statusFilter || undefined,
      OR: query
        ? [
            { sessionType: { contains: query } },
            { photographer: { contains: query } },
            { folderPath: { contains: query } },
            { customer: { name: { contains: query } } }
          ]
        : undefined
    },
    orderBy: { date: "desc" },
    include: {
      customer: true,
      orders: { where: { studioId: studio.id } },
      imageReferences: { select: { id: true } }
    }
  });
  const statuses = ["New", "In selection", "Ready for order", "Order created", "Completed", "Cancelled"];

  return (
    <AppShell>
      <PageHeader
        title="Photo Sessions"
        description="Sessions connect customer shoots to local/server folders and later orders."
        actions={<Button href="/sessions/new" variant="primary">New Session</Button>}
      />
      <section className="mb-4 rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-studio-ink">Session desk</h2>
            <p className="mt-1 text-sm text-slate-600">Find a shoot by customer, photographer, type, or folder path.</p>
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
            <input name="q" defaultValue={query} placeholder="Search sessions" />
            <select name="status" defaultValue={statusFilter}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <Button type="submit" variant="primary">Filter</Button>
          </form>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-studio-line bg-white shadow-soft">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-studio-paper text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Photographer</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Folder</th>
              <th className="px-5 py-3">Selected</th>
              <th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id} className="border-t border-studio-line">
                <td className="px-5 py-4">{formatDate(session.date)}</td>
                <td className="px-5 py-4 font-bold">{session.customer.name}</td>
                <td className="px-5 py-4">{session.sessionType}</td>
                <td className="px-5 py-4">{session.photographer}</td>
                <td className="px-5 py-4"><StatusBadge status={session.status} /></td>
                <td className="max-w-xs truncate px-5 py-4 text-slate-600">{session.folderPath}</td>
                <td className="px-5 py-4">{session.imageReferences.length}</td>
                <td className="px-5 py-4">{session.orders.length}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <Button href={`/sessions/${session.id}`} className="min-h-9 px-3 py-2">View</Button>
                    <Button href={`/sessions/${session.id}/edit`} className="min-h-9 px-3 py-2">Edit</Button>
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">
                  No sessions match the current filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
