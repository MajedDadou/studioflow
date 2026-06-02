import { updateEmailTemplate } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { emailTemplateTypes, normalizeEmailTemplateType } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";

export default async function EditEmailTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { record: template } = await requireStudioRecord((studioId) =>
    prisma.emailTemplate.findFirst({ where: { id, studioId } })
  );

  return (
    <AppShell>
      <PageHeader title="Edit Email Template" description={`Update ${template.name}.`} />
      <form action={updateEmailTemplate.bind(null, template.id)} className="grid max-w-5xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="grid gap-5 md:grid-cols-2">
          <label>
            Template name
            <input name="name" required defaultValue={template.name} />
          </label>
          <label>
            Template type
            <select name="type" required defaultValue={normalizeEmailTemplateType(template.type)}>
              {emailTemplateTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="md:col-span-2">
            Subject
            <input name="subject" required defaultValue={template.subject} />
          </label>
          <label className="flex-row items-center gap-3">
            <input name="active" type="checkbox" defaultChecked={template.active} className="h-5 w-5" /> Active
          </label>
        </div>

        <label>
          Body
          <textarea name="body" required rows={14} defaultValue={template.body} />
        </label>

        <div className="rounded-xl bg-studio-paper p-4 text-sm text-slate-700">
          Available placeholders: {"{orderId}"}, {"{customerName}"}, {"{sessionType}"}, {"{folderPath}"}, {"{deadline}"},{" "}
          {"{selectedImages}"}, {"{retouchInstructions}"}, {"{assignedRetouchers}"}, {"{productLines}"}, {"{orderTotal}"},{" "}
          {"{internalNotes}"}, {"{customerNotes}"}.
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">Save Template</Button>
          <Button href="/email-templates">Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
