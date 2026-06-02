import { updateSession } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";
import { safeJsonList } from "@/lib/format";

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

const sessionStatuses = ["New", "In selection", "Ready for order", "Order created", "Completed", "Cancelled"];

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studio, record: session } = await requireStudioRecord((studioId) =>
    prisma.photoSession.findFirst({
      where: { id, studioId },
      include: {
        customer: true,
        imageReferences: { orderBy: { createdAt: "asc" } },
        orders: { where: { studioId }, select: { id: true } }
      }
    })
  );
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
  const imageRefs = session.imageReferences.map((reference) => reference.imageRef).join("\n");

  return (
    <AppShell>
      <PageHeader
        title="Edit Session"
        description={`Update folder path, selected image references, and shoot details for ${session.customer.name}.`}
      />

      <form action={updateSession.bind(null, session.id)} className="grid max-w-5xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        {session.orders.length > 0 ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
            This session already has {session.orders.length} connected order(s). Updating selected image references here does not change existing order items.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <label>Customer
            <select name="customerId" required defaultValue={session.customerId}>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
          </label>
          <label>Session type
            <select name="sessionType" required defaultValue={session.sessionType}>
              {sessionTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>Photographer
            <select name="photographer" required defaultValue={session.photographer}>
              {photographers.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <label>Date<input name="date" type="date" required defaultValue={dateInputValue(session.date)} /></label>
          <label>Status
            <select name="status" required defaultValue={session.status}>
              {sessionStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>

        <label>Server/local folder path
          <input name="folderPath" required defaultValue={session.folderPath} />
          <span className="text-xs font-semibold text-slate-500">
            Keep this as a reference to the studio folder. StudioFlow does not move or delete image files.
          </span>
        </label>

        <label>Selected image references
          <textarea name="imageRefs" rows={8} className="font-mono text-sm" defaultValue={imageRefs} />
          <span className="text-xs font-semibold text-slate-500">
            One per line is easiest. Spaces, commas, and semicolons are also accepted.
          </span>
        </label>

        <label>Notes<textarea name="notes" rows={5} defaultValue={session.notes ?? ""} /></label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">Save Session</Button>
          <Button href={`/sessions/${session.id}`}>Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
