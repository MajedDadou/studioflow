import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { logEmailAsPrepared, toggleEmailTemplateActive } from "@/app/actions";
import {
  generateTemplateBody,
  generateTemplateSubject,
  normalizeEmailTemplateType,
  recommendedEmailRecipient
} from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";

type EmailTemplateSearchParams = {
  orderId?: string;
  templateId?: string;
};

export default async function EmailTemplatesPage({ searchParams }: { searchParams?: Promise<EmailTemplateSearchParams> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [orders, templates, logs] = await Promise.all([
    prisma.order.findMany({
      where: { studioId: studio.id },
      orderBy: { orderDate: "desc" },
      include: { customer: true },
      take: 50
    }),
    prisma.emailTemplate.findMany({ where: { studioId: studio.id }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.emailLog.findMany({
      where: { studioId: studio.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        order: { include: { customer: true } },
        template: true
      }
    })
  ]);
  const selectedOrderId = resolvedSearchParams.orderId ?? orders[0]?.id;
  const selectedTemplateId =
    resolvedSearchParams.templateId ?? templates.find((template) => template.active)?.id ?? templates[0]?.id;
  const [order, template] = await Promise.all([
    selectedOrderId
      ? prisma.order.findFirst({
          where: { id: selectedOrderId, studioId: studio.id },
          include: {
            customer: true,
            session: true,
            items: {
              orderBy: { imageRef: "asc" },
              include: {
                product: true,
                frame: true,
                retouchTask: { include: { assignedRetoucher: true } }
              }
            }
          }
        })
      : null,
    selectedTemplateId ? prisma.emailTemplate.findFirst({ where: { id: selectedTemplateId, studioId: studio.id } }) : null
  ]);
  const subject = order && template ? generateTemplateSubject(template.subject, order) : "";
  const body = order && template ? generateTemplateBody(template.body, order) : "";
  const toEmail = order && template ? recommendedEmailRecipient(template.type, order) : "";
  const fullEmail = `To: ${toEmail || "(not set)"}\nSubject: ${subject}\n\n${body}`;
  const previewReturnTo =
    order && template ? `/email-templates?orderId=${order.id}&templateId=${template.id}` : "/email-templates";

  return (
    <AppShell>
      <PageHeader
        title="Email Templates"
        description="Preview generated emails, copy them, and log prepared communication without sending real email."
        actions={<Button href="/email-templates/new" variant="primary">Create Template</Button>}
      />

      <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-black">No email provider is configured in this MVP.</p>
        <p className="mt-1">You can preview, copy, and log an email as prepared. Nothing is sent automatically.</p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-studio-ink">Templates</h2>
              <p className="text-sm text-slate-600">
                {templates.filter((templateItem) => templateItem.active).length} active,{" "}
                {templates.filter((templateItem) => !templateItem.active).length} inactive
              </p>
            </div>
            <Button href="/email-templates/new">New Template</Button>
          </div>

          <div className="mt-4 grid gap-3">
            {templates.map((templateItem) => (
              <article key={templateItem.id} className="rounded-xl bg-studio-paper p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-studio-ink">{templateItem.name}</h3>
                      <StatusBadge status={templateItem.active ? "Active" : "Inactive"} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{normalizeEmailTemplateType(templateItem.type)}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-700">{templateItem.subject}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button href={`/email-templates/${templateItem.id}/edit`}>Edit</Button>
                    <form action={toggleEmailTemplateActive.bind(null, templateItem.id)}>
                      <Button type="submit" variant={templateItem.active ? "danger" : "primary"}>
                        {templateItem.active ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
            {templates.length === 0 ? (
              <div className="rounded-xl bg-studio-paper p-6 text-center text-sm font-semibold text-slate-500">
                No templates yet. Create the first studio template.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Preview generated email</h2>
          <form className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label>
              Order
              <select name="orderId" defaultValue={selectedOrderId}>
                {orders.map((orderOption) => (
                  <option key={orderOption.id} value={orderOption.id}>
                    {orderOption.orderNumber} - {orderOption.customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Template
              <select name="templateId" defaultValue={selectedTemplateId}>
                {templates.map((templateOption) => (
                  <option key={templateOption.id} value={templateOption.id}>
                    {templateOption.name}{templateOption.active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end"><Button type="submit" variant="primary">Preview</Button></div>
          </form>

          <div className="mt-5 grid gap-4">
            <div className="rounded-xl bg-studio-paper p-4">
              <p className="text-xs font-bold uppercase text-slate-500">To</p>
              <p className="mt-1 font-bold text-studio-ink">{toEmail || "No recipient suggested"}</p>
            </div>
            <div className="rounded-xl bg-studio-paper p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Subject</p>
              <p className="mt-1 font-bold text-studio-ink">{subject || "No subject"}</p>
            </div>
            <pre className="max-h-[520px] overflow-auto rounded-xl bg-slate-950 p-5 text-sm leading-6 text-slate-100">
              {body || "Choose an order and template to preview email content."}
            </pre>
          </div>

          {order && template ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <CopyButton text={fullEmail} />
              <form action={logEmailAsPrepared} className="flex flex-wrap gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="templateId" value={template.id} />
                <input type="hidden" name="returnTo" value={previewReturnTo} />
                <input name="toEmail" defaultValue={toEmail} placeholder="Recipient email" className="min-w-72" />
                <Button type="submit" variant="primary">Log as Prepared</Button>
              </form>
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-studio-line bg-white shadow-soft">
        <div className="border-b border-studio-line p-5">
          <h2 className="text-lg font-black text-studio-ink">Email log</h2>
          <p className="mt-1 text-sm text-slate-600">Prepared communication history. This does not mean the email was sent.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-studio-paper text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Template</th>
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-studio-line">
                  <td className="px-5 py-4">{formatDateTime(log.createdAt)}</td>
                  <td className="px-5 py-4">
                    {log.order ? (
                      <a href={`/orders/${log.order.id}`} className="font-bold text-studio-orangeDark hover:underline">
                        {log.order.orderNumber} - {log.order.customer.name}
                      </a>
                    ) : "-"}
                  </td>
                  <td className="px-5 py-4">{log.template?.name ?? "-"}</td>
                  <td className="px-5 py-4">{log.toEmail || "-"}</td>
                  <td className="px-5 py-4"><StatusBadge status={log.status} /></td>
                  <td className="px-5 py-4"><Button href={`/email-logs/${log.id}`}>View Log</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500">
            No prepared email logs yet.
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
