import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { createBridgeTestFolders } from "@/app/actions";
import { buildFolderPlan } from "@/lib/folderPlan";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatDateTime } from "@/lib/format";

export default async function LocalBridgePage({ searchParams }: { searchParams?: Promise<{ orderId?: string; bridgeMessage?: string }> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const orders = await prisma.order.findMany({
    where: { studioId: studio.id },
    orderBy: { orderDate: "desc" },
    include: { customer: true }
  });
  const selectedOrderId = resolvedSearchParams.orderId ?? orders[0]?.id;
  const selectedOrder = selectedOrderId
    ? await prisma.order.findUnique({
        where: { id: selectedOrderId },
        include: {
          customer: true,
          session: true,
          items: {
            include: {
              product: true,
              frame: true,
              retouchTask: { include: { assignedRetoucher: true } }
            }
          }
        }
      })
    : null;
  const plan = selectedOrder ? buildFolderPlan(selectedOrder) : null;
  const logs = await prisma.bridgeLog.findMany({ where: { studioId: studio.id }, orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <AppShell>
      <PageHeader
        title="Local Bridge / Folder Automation"
        description="Safe simulator only. Preview first, then optionally create test folders inside the project safe-test-folder."
      />

      {resolvedSearchParams.bridgeMessage ? (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          {resolvedSearchParams.bridgeMessage}
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <h2 className="font-black">Bridge architecture explanation</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <p>Cloud app stores orders, customers, tasks, settings, and communication templates.</p>
          <p>Local bridge app handles folders and local files after explicit approval.</p>
          <p>StudioFlow should only touch approved folders and should copy files, not delete originals.</p>
          <p>Every action should be previewed first and logged afterwards.</p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Generate folder plan</h2>
          <form className="mt-4 grid gap-4">
            <label>Order
              <select name="orderId" defaultValue={selectedOrderId}>
                {orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} - {order.customer.name}</option>)}
              </select>
            </label>
            <Button type="submit" variant="primary">Generate folder plan</Button>
          </form>
          {plan ? (
            <div className="mt-6 grid gap-3">
              <p className="text-sm font-bold text-slate-500">Safe test base folder</p>
              <p className="break-all rounded-xl bg-studio-paper p-3 text-sm">{plan.safeRoot}</p>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                Production bridge automation is not active. This button can only create empty test folders and one summary file inside the safe test folder.
              </div>
              {plan.warnings.map((warning) => (
                <p key={warning} className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">{warning}</p>
              ))}
              <form action={createBridgeTestFolders} className="flex flex-wrap gap-2">
                <input type="hidden" name="orderId" value={selectedOrderId} />
                <input type="hidden" name="dryRun" value="true" />
                <Button type="submit">Preview Folder Plan</Button>
              </form>
              <form action={createBridgeTestFolders} className="flex flex-wrap gap-2">
                <input type="hidden" name="orderId" value={selectedOrderId} />
                <input type="hidden" name="dryRun" value="false" />
                <Button type="submit" variant="primary">Create test folders</Button>
              </form>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Folder plan preview</h2>
          {plan ? (
            <div className="mt-4 grid gap-3">
              <pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">{[
                "StudioFlow_Test/",
                `  ${plan.relativeRoot}/`,
                "    01_SELECTED/",
                "    02_RETOUCH/",
                "    03_READY/",
                "    04_DELIVERED/",
                "    order-summary.txt"
              ].join("\n")}</pre>
              <pre className="max-h-96 overflow-auto rounded-xl bg-studio-paper p-4 text-sm text-slate-800">{plan.summaryContent}</pre>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No order selected.</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Bridge action log</h2>
        <div className="mt-4 grid gap-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-xl bg-studio-paper p-4">
              <p className="font-bold text-studio-ink">{log.action} - {log.status}</p>
              <p className="text-sm text-slate-600">{log.message}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
