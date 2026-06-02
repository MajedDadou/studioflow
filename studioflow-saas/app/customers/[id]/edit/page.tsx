import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { updateCustomer } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { record: customer } = await requireStudioRecord((studioId) =>
    prisma.customer.findFirst({ where: { id, studioId } })
  );

  return (
    <AppShell>
      <PageHeader title="Edit Customer" description={`Update profile for ${customer.name}.`} />
      <form action={updateCustomer.bind(null, customer.id)} className="grid max-w-3xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <label>Name<input name="name" required autoComplete="name" defaultValue={customer.name} /></label>
        <div className="grid gap-5 md:grid-cols-2">
          <label>Phone<input name="phone" autoComplete="tel" defaultValue={customer.phone ?? ""} /></label>
          <label>Email<input name="email" type="email" autoComplete="email" defaultValue={customer.email ?? ""} /></label>
        </div>
        <label>Notes<textarea name="notes" rows={5} defaultValue={customer.notes ?? ""} /></label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Save Customer</Button>
          <Button href={`/customers/${customer.id}`}>Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
