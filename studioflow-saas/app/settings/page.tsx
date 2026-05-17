import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { updateSettings } from "@/app/actions";
import { getActiveStudio } from "@/lib/studio";
import { safeJsonList } from "@/lib/format";

export default async function SettingsPage() {
  const studio = await getActiveStudio();
  const settings = studio.settings;
  const workflowStatuses = safeJsonList(settings?.workflowStatusesJson, []);
  const retouchTypes = safeJsonList(settings?.retouchTypesJson, []);
  const photographers = safeJsonList(settings?.photographersJson, []);

  return (
    <AppShell>
      <PageHeader
        title="Studio Settings"
        description="Each studio can adjust workflow statuses, folder naming, capture tool, retouch types, products, photographers, and retouchers."
      />
      <form action={updateSettings} className="grid max-w-5xl gap-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="grid gap-5 md:grid-cols-2">
          <label>Studio name<input name="studioName" required defaultValue={studio.name} /></label>
          <label>Order id format<input name="orderIdFormat" required defaultValue={settings?.orderIdFormat ?? "{studioCode}-{year}-{sequence4}"} /></label>
          <label>Default folder path<input name="defaultFolderPath" required defaultValue={settings?.defaultFolderPath ?? "safe-test-folder/StudioFlow_Test"} /></label>
          <label>Folder naming format<input name="folderNamingFormat" required defaultValue={settings?.folderNamingFormat ?? "{year}/{date}_{customerName}_{orderId}"} /></label>
          <label>Capture workflow
            <select name="captureTool" defaultValue={settings?.captureTool ?? "Lightroom"}>
              <option>Lightroom</option>
              <option>Capture One</option>
              <option>Manual folders</option>
            </select>
          </label>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <label>Default workflow statuses<textarea name="workflowStatuses" rows={10} defaultValue={workflowStatuses.join("\n")} /></label>
          <label>Retouch types<textarea name="retouchTypes" rows={10} defaultValue={retouchTypes.join("\n")} /></label>
          <label>Photographer list<textarea name="photographers" rows={10} defaultValue={photographers.join("\n")} /></label>
        </div>
        <div className="rounded-xl bg-studio-paper p-4 text-sm text-slate-700">
          Folder naming examples: {"{year}/{date}_{customerName}_{orderId}"}, {"{year}/{customerName}/{orderId}"}, {"{photographer}/{date}_{customerName}"}.
        </div>
        <Button type="submit" variant="primary">Save settings</Button>
      </form>
    </AppShell>
  );
}
