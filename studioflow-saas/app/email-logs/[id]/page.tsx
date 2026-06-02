import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";

export default async function EmailLogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { record: log } = await requireStudioRecord((studioId) =>
    prisma.emailLog.findFirst({
      where: { id, studioId },
      include: {
        template: true,
        order: {
          include: {
            customer: true,
            session: true
          }
        }
      }
    })
  );
  const copyText = `To: ${log.toEmail || "(not set)"}\nSubject: ${log.subject}\n\n${log.body}`;

  return (
    <AppShell>
      <PageHeader
        title="Email Log Detail"
        description={log.order ? `${log.order.orderNumber} - ${log.order.customer.name}` : "Prepared email record"}
        actions={
          <>
            <CopyButton text={copyText} />
            <Button href="/email-templates">Back to Email Templates</Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Log metadata</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div><dt className="font-bold text-slate-500">Status</dt><dd className="mt-1"><StatusBadge status={log.status} /></dd></div>
            <div><dt className="font-bold text-slate-500">Created</dt><dd>{formatDateTime(log.createdAt)}</dd></div>
            <div><dt className="font-bold text-slate-500">Sent at</dt><dd>{log.sentAt ? formatDateTime(log.sentAt) : "Not sent from StudioFlow"}</dd></div>
            <div><dt className="font-bold text-slate-500">To</dt><dd className="break-all">{log.toEmail || "-"}</dd></div>
            <div><dt className="font-bold text-slate-500">Template</dt><dd>{log.template?.name ?? "-"}</dd></div>
            <div><dt className="font-bold text-slate-500">Error</dt><dd>{log.errorMessage ?? "-"}</dd></div>
          </dl>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <div className="rounded-xl bg-studio-paper p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Subject</p>
            <p className="mt-1 font-bold text-studio-ink">{log.subject}</p>
          </div>
          <pre className="mt-4 max-h-[640px] overflow-auto rounded-xl bg-slate-950 p-5 text-sm leading-6 text-slate-100">{log.body}</pre>
        </section>
      </div>

      {log.order ? (
        <section className="mt-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Order context</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div><dt className="font-bold text-slate-500">Order</dt><dd><a href={`/orders/${log.order.id}`} className="font-bold text-studio-orangeDark hover:underline">{log.order.orderNumber}</a></dd></div>
            <div><dt className="font-bold text-slate-500">Customer</dt><dd>{log.order.customer.name}</dd></div>
            <div><dt className="font-bold text-slate-500">Session</dt><dd>{log.order.session.sessionType}</dd></div>
            <div><dt className="font-bold text-slate-500">Folder</dt><dd className="break-all">{log.order.session.folderPath}</dd></div>
          </dl>
        </section>
      ) : null}
    </AppShell>
  );
}
