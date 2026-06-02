import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { createBridgeTestFolders } from "@/app/actions";
import { buildFolderPlan } from "@/lib/folderPlan";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatDateTime } from "@/lib/format";

export default async function LocalBridgePage({
  searchParams
}: {
  searchParams?: Promise<{ orderId?: string; bridgeMessage?: string }>;
}) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const orders = await prisma.order.findMany({
    where: { studioId: studio.id },
    orderBy: { orderDate: "desc" },
    include: { customer: true }
  });
  const selectedOrderId = resolvedSearchParams.orderId ?? orders[0]?.id;
  const selectedOrder = selectedOrderId
    ? await prisma.order.findFirst({
        where: { id: selectedOrderId, studioId: studio.id },
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
  const [logs, jobs, generatedFiles] = await Promise.all([
    prisma.bridgeLog.findMany({
      where: { studioId: studio.id },
      include: { bridgeJob: { include: { order: true } } },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    prisma.bridgeJob.findMany({
      where: { studioId: studio.id },
      include: { order: true, generatedFiles: true, logs: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.generatedFile.findMany({
      where: { studioId: studio.id },
      include: { order: true, bridgeJob: true },
      orderBy: { createdAt: "desc" },
      take: 12
    })
  ]);
  const bridgeMessage = resolvedSearchParams.bridgeMessage;
  const messageIsWarning = bridgeMessage ? /blocked|failed|unsafe/i.test(bridgeMessage) : false;
  const latestJob = jobs[0] ?? null;
  const latestCreatedLogs = latestJob?.logs.filter((log) => log.status === "Created") ?? [];
  const latestSkippedLogs = latestJob?.logs.filter((log) => log.status === "Skipped") ?? [];
  const latestBlockedLogs = latestJob?.logs.filter((log) => log.status === "Blocked" || /blocked|unsafe/i.test(log.message)) ?? [];
  const latestPreviewLogs = latestJob?.logs.filter((log) => log.status === "Preview") ?? [];
  const folderTree = plan
    ? [
        "StudioFlow_Test/",
        `  ${plan.relativeRoot}/`,
        ...plan.folders
          .filter((folder) => folder.relativePath !== plan.relativeRoot)
          .map((folder) => `    ${folder.relativePath.replace(`${plan.relativeRoot}/`, "")}/`),
        ...plan.files.map((file) => `    ${file.filename}`)
      ]
    : [];

  return (
    <AppShell>
      <PageHeader
        title="Local Bridge / Folder Automation"
        description="Safe automation prototype. Dry-run is the default, and creation is blocked outside safe-test-folder/StudioFlow_Test."
      />

      {bridgeMessage ? (
        <div
          className={`mb-4 rounded-2xl border p-4 text-sm font-bold ${
            messageIsWarning ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {bridgeMessage}
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black">Bridge architecture explanation</h2>
            <p className="mt-2 max-w-3xl">
              StudioFlow stores customers, orders, tasks, settings, generated file records, and communication logs. A future
              local bridge app would run on a studio computer and handle approved local folder work only.
            </p>
          </div>
          <StatusBadge status="Dry-run default" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-white/70 p-4">
            <p className="font-black text-studio-ink">Cloud app</p>
            <p className="mt-1">Stores workflow data, settings, orders, tasks, templates, and audit history.</p>
          </div>
          <div className="rounded-xl bg-white/70 p-4">
            <p className="font-black text-studio-ink">Local bridge</p>
            <p className="mt-1">Handles folders and local text files after explicit preview and approval.</p>
          </div>
          <div className="rounded-xl bg-white/70 p-4">
            <p className="font-black text-studio-ink">Approved folder</p>
            <p className="mt-1 break-all">Only safe-test-folder/StudioFlow_Test is writable in this MVP.</p>
          </div>
          <div className="rounded-xl bg-white/70 p-4">
            <p className="font-black text-studio-ink">Safety rule</p>
            <p className="mt-1">No deletes, no moves, no overwrites, and no changes to real image files.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Generate folder plan</h2>
          <form className="mt-4 grid gap-4">
            <label>
              Order
              <select name="orderId" defaultValue={selectedOrderId}>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} - {order.customer.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="primary">
              Generate folder plan
            </Button>
          </form>

          {plan ? (
            <div className="mt-6 grid gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">Safe test base folder</p>
                <p className="mt-2 break-all rounded-xl bg-studio-paper p-3 text-sm">{plan.safeRoot}</p>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
                Create test folders never touches paths outside the safe test folder. Existing text files are skipped, not overwritten.
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <form action={createBridgeTestFolders}>
                  <input type="hidden" name="orderId" value={selectedOrderId} />
                  <input type="hidden" name="dryRun" value="true" />
                  <Button type="submit" className="w-full">
                    Preview folder plan
                  </Button>
                </form>
                <form action={createBridgeTestFolders}>
                  <input type="hidden" name="orderId" value={selectedOrderId} />
                  <input type="hidden" name="dryRun" value="false" />
                  <Button type="submit" variant="primary" className="w-full">
                    Create test folders
                  </Button>
                </form>
              </div>

              <div>
                <h3 className="font-black text-studio-ink">Safety checks</h3>
                <div className="mt-3 grid gap-2">
                  {plan.warnings.map((warning) => (
                    <p key={warning} className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No orders are available for this studio yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Folder plan preview</h2>
          {plan ? (
            <div className="mt-4 grid gap-4">
              <pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100">{folderTree.join("\n")}</pre>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-studio-line p-4">
                  <h3 className="font-black text-studio-ink">What would be created</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {plan.folders.map((folder) => (
                      <li key={folder.relativePath} className="break-all rounded-lg bg-studio-paper px-3 py-2">
                        Folder: {folder.relativePath}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-studio-line p-4">
                  <h3 className="font-black text-studio-ink">Generated text files</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {plan.files.map((file) => (
                      <li key={file.relativePath} className="break-all rounded-lg bg-studio-paper px-3 py-2">
                        {file.fileType}: {file.relativePath}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid gap-4">
                {plan.files.map((file) => (
                  <div key={file.fileType} className="rounded-xl border border-studio-line">
                    <div className="border-b border-studio-line px-4 py-3">
                      <p className="font-black text-studio-ink">{file.filename}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{file.relativePath}</p>
                    </div>
                    <pre className="max-h-72 overflow-auto bg-studio-paper p-4 text-sm text-slate-800">{file.content}</pre>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No order selected.</p>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-studio-ink">Latest run result</h2>
            <p className="mt-1 text-sm text-slate-600">Created, skipped, and blocked actions from the newest bridge job.</p>
          </div>
          {latestJob ? <StatusBadge status={latestJob.status} /> : null}
        </div>
        {latestJob ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            <div className="rounded-xl border border-studio-line p-4">
              <p className="text-sm font-black text-studio-ink">Job</p>
              <p className="mt-2 font-bold">{latestJob.type}</p>
              <p className="mt-1 text-sm text-slate-600">{latestJob.order?.orderNumber ?? "No order"} - {latestJob.dryRun ? "Dry-run" : "Create"}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-black text-emerald-900">What was created</p>
              <div className="mt-3 grid gap-2 text-sm text-emerald-900">
                {latestCreatedLogs.length > 0 ? (
                  latestCreatedLogs.map((log) => <p key={log.id} className="break-all rounded-lg bg-white/80 p-2">{log.message}</p>)
                ) : (
                  <p>No files or folders were newly created in this run.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-black text-amber-950">What was skipped</p>
              <div className="mt-3 grid gap-2 text-sm text-amber-950">
                {latestSkippedLogs.length > 0 ? (
                  latestSkippedLogs.map((log) => <p key={log.id} className="break-all rounded-lg bg-white/80 p-2">{log.message}</p>)
                ) : (
                  <p>Nothing was skipped in this run.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-black text-red-900">Why something was blocked</p>
              <div className="mt-3 grid gap-2 text-sm text-red-900">
                {latestBlockedLogs.length > 0 ? (
                  latestBlockedLogs.map((log) => <p key={log.id} className="break-all rounded-lg bg-white/80 p-2">{log.message}</p>)
                ) : latestPreviewLogs.length > 0 ? (
                  <p>This was a dry-run preview. Nothing was created.</p>
                ) : (
                  <p>No unsafe path was blocked in this run.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No bridge job has been run yet.</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Recent bridge jobs</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-studio-line">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Order</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Files</th>
                <th>Logs</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-studio-line">
                  <td className="px-5 py-4 font-bold text-studio-ink">{job.type}</td>
                  <td className="px-5 py-4">{job.order?.orderNumber ?? "-"}</td>
                  <td className="px-5 py-4">{job.dryRun ? "Dry-run" : "Create"}</td>
                  <td className="px-5 py-4"><StatusBadge status={job.status} /></td>
                  <td className="px-5 py-4">{job.generatedFiles.length}</td>
                  <td className="px-5 py-4">{job.logs.length}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDateTime(job.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 ? <p className="p-5 text-sm text-slate-600">No bridge jobs have been logged yet.</p> : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Generated file records</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-studio-line">
          <table>
            <thead>
              <tr>
                <th>File type</th>
                <th>Order</th>
                <th>Path</th>
                <th>Checksum</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {generatedFiles.map((file) => (
                <tr key={file.id} className="border-t border-studio-line">
                  <td className="px-5 py-4 font-bold text-studio-ink">{file.fileType}</td>
                  <td className="px-5 py-4">{file.order?.orderNumber ?? "-"}</td>
                  <td className="break-all px-5 py-4 text-sm text-slate-600">{file.path}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">{file.checksum ? file.checksum.slice(0, 12) : "-"}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDateTime(file.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {generatedFiles.length === 0 ? <p className="p-5 text-sm text-slate-600">No generated files have been recorded yet.</p> : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <h2 className="text-lg font-black text-studio-ink">Bridge action log</h2>
        <div className="mt-4 grid gap-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-xl bg-studio-paper p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-bold text-studio-ink">{log.action}</p>
                <StatusBadge status={log.status} />
              </div>
              <p className="mt-2 break-all text-sm text-slate-600">{log.message}</p>
              <p className="mt-2 text-xs text-slate-500">
                {log.bridgeJob?.type ?? "System log"} {log.bridgeJob?.order?.orderNumber ? `- ${log.bridgeJob.order.orderNumber}` : ""} -{" "}
                {formatDateTime(log.createdAt)}
              </p>
            </div>
          ))}
          {logs.length === 0 ? <p className="rounded-xl bg-studio-paper p-4 text-sm text-slate-600">No bridge actions have been logged yet.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
