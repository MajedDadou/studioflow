import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatDate } from "@/lib/format";

export default async function SessionsPage() {
  const studio = await getActiveStudio();
  const sessions = await prisma.photoSession.findMany({
    where: { studioId: studio.id },
    orderBy: { date: "desc" },
    include: { customer: true, orders: true }
  });

  return (
    <AppShell>
      <PageHeader
        title="Photo Sessions"
        description="Sessions connect customer shoots to local/server folders and later orders."
        actions={<Button href="/sessions/new" variant="primary">New Session</Button>}
      />
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
                <td className="px-5 py-4">{session.orders.length}</td>
                <td className="px-5 py-4"><Button href={`/sessions/${session.id}`} className="min-h-9 px-3 py-2">View</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
