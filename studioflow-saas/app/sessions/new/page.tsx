import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { createSession } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { safeJsonList } from "@/lib/format";

export default async function NewSessionPage({ searchParams }: { searchParams?: Promise<{ customerId?: string }> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [customers] = await Promise.all([
    prisma.customer.findMany({ where: { studioId: studio.id }, orderBy: { name: "asc" } })
  ]);
  const photographers = safeJsonList(studio.settings?.photographersJson, ["Martin", "Sanne", "Daniel"]);
  const sessionTypes = safeJsonList(studio.settings?.sessionTypesJson, [
    "Family shoot",
    "Passport photo",
    "Portrait",
    "Wedding",
    "Product photo",
    "School photo",
    "Other"
  ]);
  const selectedCustomerId = customers.some((customer) => customer.id === resolvedSearchParams.customerId)
    ? resolvedSearchParams.customerId
    : "";

  return (
    <AppShell>
      <PageHeader
        title="New Session"
        description="Connect a customer shoot to the folder path and selected image references before creating an order."
      />
      <form action={createSession} className="grid max-w-4xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        {customers.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Create a customer first. Sessions need a customer so staff can find previous visits and orders later.
          </div>
        ) : null}
        <div className="grid gap-5 md:grid-cols-2">
          <label>Customer
            <select name="customerId" required defaultValue={selectedCustomerId}>
              <option value="">Choose customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label>Session type
            <select name="sessionType" required>
              {sessionTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>Photographer
            <select name="photographer" required>
              {photographers.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label>Date<input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
          <label>Status
            <select name="status" defaultValue="New">
              <option>New</option>
              <option>In selection</option>
              <option>Ready for order</option>
              <option>Order created</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </label>
        </div>
        <label>Server/local folder path
          <input name="folderPath" required placeholder="safe-test-folder/StudioFlow_Test/2026/Familien_Hansen" />
          <span className="text-xs font-semibold text-slate-500">This is only a reference for the order. The web app does not move or scan image files.</span>
        </label>
        <label>Selected image references
          <textarea
            name="imageRefs"
            rows={7}
            className="font-mono text-sm"
            placeholder={"IMG_1023.CR3\nIMG_1024.CR3\n1025"}
          />
          <span className="text-xs font-semibold text-slate-500">
            Optional. Paste filenames or image numbers from Lightroom. StudioFlow stores text references only.
          </span>
        </label>
        <label>Notes<textarea name="notes" rows={4} placeholder="Lightroom selection notes, customer preferences, delivery context" /></label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary">New Session</Button>
          <Button href="/customers/new">New Customer</Button>
          <Button href="/sessions">Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
