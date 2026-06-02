import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { createCustomer } from "@/app/actions";

export default function NewCustomerPage() {
  return (
    <AppShell>
      <PageHeader title="New Customer" description="Create a customer profile before connecting sessions and orders." />
      <form action={createCustomer} className="grid max-w-3xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
          Start with the customer profile. The next step is creating the photo session and connecting it to a folder path.
        </div>
        <label>Name<input name="name" required autoComplete="name" placeholder="Familien Hansen" /></label>
        <div className="grid gap-5 md:grid-cols-2">
          <label>Phone<input name="phone" autoComplete="tel" placeholder="12 34 56 78" /></label>
          <label>Email<input name="email" type="email" autoComplete="email" placeholder="customer@example.dk" /></label>
        </div>
        <label>Notes<textarea name="notes" rows={5} placeholder="Preferences, yearly sessions, delivery notes" /></label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">New Customer</Button>
          <Button href="/customers">Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
