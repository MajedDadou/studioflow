import { updateRetouchTask } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { safeJsonList } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { retouchStatuses } from "@/lib/retouch";
import { requireStudioRecord } from "@/lib/studio";

function dateInputValue(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export default async function EditRetouchTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studio, record: task } = await requireStudioRecord((studioId) =>
    prisma.retouchTask.findFirst({
      where: { id, studioId },
      include: {
        assignedRetoucher: true,
        orderItem: {
          include: {
            order: { include: { customer: true } }
          }
        }
      }
    })
  );
  const retouchTypes = safeJsonList(studio.settings?.retouchTypesJson, ["None", "Standard", "Advanced"]);
  const retouchers = await prisma.retoucher.findMany({
    where: {
      studioId: studio.id,
      OR: [{ active: true }, ...(task.assignedRetoucherId ? [{ id: task.assignedRetoucherId }] : [])]
    },
    orderBy: { name: "asc" }
  });

  return (
    <AppShell>
      <PageHeader
        title={`Edit Retouch Task`}
        description={`${task.orderItem.imageRef} for ${task.orderItem.order.customer.name} - ${task.orderItem.order.orderNumber}`}
      />

      <form action={updateRetouchTask.bind(null, task.id)} className="grid max-w-5xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="grid gap-5 md:grid-cols-2">
          <label>
            Status
            <select name="status" required defaultValue={task.status}>
              {retouchStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Assigned retoucher
            <select name="assignedRetoucherId" defaultValue={task.assignedRetoucherId ?? ""}>
              <option value="">Unassigned</option>
              {retouchers.map((retoucher) => (
                <option key={retoucher.id} value={retoucher.id}>
                  {retoucher.name}{retoucher.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Retouch type
            <select name="retouchType" required defaultValue={task.retouchType}>
              {retouchTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Deadline
            <input name="deadline" type="date" defaultValue={dateInputValue(task.deadline)} />
          </label>
          <label className="flex-row items-center gap-3">
            <input name="urgent" type="checkbox" defaultChecked={task.urgent} className="h-5 w-5" /> Urgent
          </label>
        </div>

        <label>
          Retouch notes
          <textarea name="notes" rows={7} defaultValue={task.notes ?? ""} placeholder="Describe exactly what the retoucher should fix." />
        </label>

        <div className="rounded-xl bg-studio-paper p-4 text-sm text-slate-700">
          Changes here stay linked to the selected order item, so retouch notes and urgency remain visible on the order page.
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">Save Retouch Task</Button>
          <Button href={`/retouch/${task.id}`}>Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
