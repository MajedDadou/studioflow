import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { PageHeader } from "@/components/PageHeader";
import { generateTemplateBody, generateTemplateSubject } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";

export default async function EmailTemplatesPage({ searchParams }: { searchParams?: Promise<{ orderId?: string; templateId?: string }> }) {
  const studio = await getActiveStudio();
  const resolvedSearchParams = (await searchParams) ?? {};
  const [orders, templates] = await Promise.all([
    prisma.order.findMany({ where: { studioId: studio.id }, orderBy: { orderDate: "desc" }, include: { customer: true } }),
    prisma.emailTemplate.findMany({ where: { studioId: studio.id, active: true }, orderBy: { name: "asc" } })
  ]);
  const selectedOrderId = resolvedSearchParams.orderId ?? orders[0]?.id;
  const selectedTemplateId = resolvedSearchParams.templateId ?? templates[0]?.id;
  const [order, template] = await Promise.all([
    selectedOrderId
      ? prisma.order.findUnique({
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
      : null,
    selectedTemplateId ? prisma.emailTemplate.findUnique({ where: { id: selectedTemplateId } }) : null
  ]);
  const subject = order && template ? generateTemplateSubject(template.subject, order) : "";
  const body = order && template ? generateTemplateBody(template.body, order) : "";
  const fullEmail = `Subject: ${subject}\n\n${body}`;

  return (
    <AppShell>
      <PageHeader
        title="Email Templates"
        description="Preview and copy generated communication. The MVP does not send real email."
      />
      <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
        No real email is sent from this MVP. Use the preview to check retouch instructions, then copy the text into your existing email or chat workflow.
      </section>
      <form className="mb-6 grid gap-4 rounded-2xl border border-studio-line bg-white p-5 shadow-soft md:grid-cols-[1fr_1fr_auto]">
        <label>Order
          <select name="orderId" defaultValue={selectedOrderId}>
            {orders.map((orderOption) => <option key={orderOption.id} value={orderOption.id}>{orderOption.orderNumber} - {orderOption.customer.name}</option>)}
          </select>
        </label>
        <label>Template
          <select name="templateId" defaultValue={selectedTemplateId}>
            {templates.map((templateOption) => <option key={templateOption.id} value={templateOption.id}>{templateOption.name}</option>)}
          </select>
        </label>
        <div className="flex items-end"><Button type="submit" variant="primary">Preview email</Button></div>
      </form>

      <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-studio-ink">{template?.name ?? "No template"}</h2>
            <p className="mt-1 text-sm text-slate-600">Generated preview only. Copy it into your email client or retouch handoff tool.</p>
          </div>
          {fullEmail ? <CopyButton text={fullEmail} /> : null}
        </div>
        <div className="mt-5 grid gap-4">
          <div className="rounded-xl bg-studio-paper p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Subject</p>
            <p className="mt-1 font-bold text-studio-ink">{subject || "No subject"}</p>
          </div>
          <pre className="max-h-[560px] overflow-auto rounded-xl bg-slate-950 p-5 text-sm leading-6 text-slate-100">{body || "Choose an order and template to preview email content."}</pre>
        </div>
      </section>
    </AppShell>
  );
}
