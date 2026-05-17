import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatDate } from "@/lib/format";

export default async function CustomersPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = resolvedSearchParams.q?.trim() ?? "";
  const customers = await prisma.customer.findMany({
    where: {
      studioId: studio.id,
      OR: query
        ? [
            { name: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } }
          ]
        : undefined
    },
    orderBy: { createdAt: "desc" },
    include: { sessions: true, orders: true }
  });

  return (
    <AppShell>
      <PageHeader
        title="Customers"
        description="Search customers, open their history, or create a new customer before a session."
        actions={<Button href="/customers/new" variant="primary">New Customer</Button>}
      />
      <form className="mb-4 flex max-w-xl gap-2">
        <input name="q" defaultValue={query} placeholder="Search customers by name, email, or phone" className="flex-1" />
        <Button type="submit">Search</Button>
      </form>
      <section className="overflow-hidden rounded-2xl border border-studio-line bg-white shadow-soft">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-studio-paper text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Sessions</th>
              <th className="px-5 py-3">Orders</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-studio-line">
                <td className="px-5 py-4 font-bold">{customer.name}</td>
                <td className="px-5 py-4">{customer.phone ?? "-"}</td>
                <td className="px-5 py-4">{customer.email ?? "-"}</td>
                <td className="px-5 py-4">{customer.sessions.length}</td>
                <td className="px-5 py-4">{customer.orders.length}</td>
                <td className="px-5 py-4">{formatDate(customer.createdAt)}</td>
                <td className="px-5 py-4"><Button href={`/customers/${customer.id}`} className="min-h-9 px-3 py-2">View</Button></td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm font-semibold text-slate-500">
                  No customers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
