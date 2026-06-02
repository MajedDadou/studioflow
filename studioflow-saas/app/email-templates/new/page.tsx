import { createEmailTemplate } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { emailTemplateTypes } from "@/lib/email";

const defaultBodies: Record<string, string> = {
  "Retouch task email":
    "Hi,\n\nA retouch order is ready.\n\nOrder: {orderId}\nCustomer/session: {customerName} - {sessionType}\nDeadline: {deadline}\nFolder: {folderPath}\nAssigned retoucher(s): {assignedRetouchers}\n\nSelected images:\n{selectedImages}\n\nRetouch instructions:\n{retouchInstructions}\n\nInternal notes:\n{internalNotes}\n",
  "Customer order confirmation":
    "Hi {customerName},\n\nThank you for your order.\n\nOrder: {orderId}\nTotal: {orderTotal}\n\nProducts:\n{productLines}\n\nCustomer notes:\n{customerNotes}\n\nWe will contact you when everything is ready.\n",
  "Order ready for pickup/delivery":
    "Hi {customerName},\n\nYour order {orderId} is ready for pickup/delivery.\n\nBest regards,\nStudioFlow demo studio\n",
  "Internal note": "Order: {orderId}\nCustomer: {customerName}\nFolder: {folderPath}\n\nInternal notes:\n{internalNotes}\n"
};

export default function NewEmailTemplatePage() {
  return (
    <AppShell>
      <PageHeader title="Create Email Template" description="Create a reusable template for generated studio communication." />
      <form action={createEmailTemplate} className="grid max-w-5xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="grid gap-5 md:grid-cols-2">
          <label>
            Template name
            <input name="name" required placeholder="Retouch handoff to Nadhif" />
          </label>
          <label>
            Template type
            <select name="type" required defaultValue="Retouch task email">
              {emailTemplateTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="md:col-span-2">
            Subject
            <input name="subject" required placeholder="Retouch task {orderId} - {customerName}" />
          </label>
          <label className="flex-row items-center gap-3">
            <input name="active" type="checkbox" defaultChecked className="h-5 w-5" /> Active
          </label>
        </div>

        <label>
          Body
          <textarea name="body" required rows={14} defaultValue={defaultBodies["Retouch task email"]} />
        </label>

        <div className="rounded-xl bg-studio-paper p-4 text-sm text-slate-700">
          Available placeholders: {"{orderId}"}, {"{customerName}"}, {"{sessionType}"}, {"{folderPath}"}, {"{deadline}"},{" "}
          {"{selectedImages}"}, {"{retouchInstructions}"}, {"{assignedRetouchers}"}, {"{productLines}"}, {"{orderTotal}"},{" "}
          {"{internalNotes}"}, {"{customerNotes}"}.
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">Create Template</Button>
          <Button href="/email-templates">Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
