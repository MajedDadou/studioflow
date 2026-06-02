import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { updateSettings } from "@/app/actions";
import { getActiveStudio } from "@/lib/studio";
import { safeJsonList } from "@/lib/format";

export default async function SettingsPage() {
  const studio = await getActiveStudio();
  const settings = studio.settings;
  const workflowStatuses = safeJsonList(settings?.workflowStatusesJson, [
    "Draft",
    "New",
    "Waiting for files",
    "Waiting for retouch",
    "In retouch",
    "Ready for review",
    "Ready for delivery",
    "Delivered",
    "Cancelled"
  ]);
  const sessionTypes = safeJsonList(settings?.sessionTypesJson, [
    "Family shoot",
    "Passport photo",
    "Portrait",
    "Wedding",
    "Product photo",
    "School photo",
    "Other"
  ]);
  const retouchTypes = safeJsonList(settings?.retouchTypesJson, ["None", "Standard", "Advanced"]);
  const photographers = safeJsonList(settings?.photographersJson, ["Martin", "Sanne", "Daniel"]);
  const timezones = ["Europe/Copenhagen", "Europe/Stockholm", "Europe/Oslo", "Europe/Berlin", "Europe/London", "America/New_York"];

  return (
    <AppShell>
      <PageHeader
        title="Studio Settings"
        description="Configure this studio's identity, workflow, folder naming, capture tool, session types, retouch types, and staff lists."
      />
      <form action={updateSettings} className="grid max-w-5xl gap-6 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="grid gap-5 md:grid-cols-2">
          <label>
            Studio name
            <input name="studioName" required defaultValue={studio.name} />
          </label>
          <label>
            Country
            <input name="country" required defaultValue={studio.country} placeholder="Denmark" />
          </label>
          <label>
            Timezone
            <select name="timezone" required defaultValue={studio.timezone}>
              {timezones.map((timezone) => (
                <option key={timezone}>{timezone}</option>
              ))}
            </select>
          </label>
          <label>
            Order number format
            <input name="orderIdFormat" required defaultValue={settings?.orderIdFormat ?? "{studioCode}-{year}-{sequence4}"} />
          </label>
          <label>
            Default folder path
            <input name="defaultFolderPath" required defaultValue={settings?.defaultFolderPath ?? "safe-test-folder/StudioFlow_Test"} />
          </label>
          <label>
            Folder naming format
            <input name="folderNamingFormat" required defaultValue={settings?.folderNamingFormat ?? "{year}/{date}_{customerName}_{orderId}"} />
          </label>
          <label>Capture workflow
            <select name="captureTool" required defaultValue={settings?.captureTool ?? "Lightroom"}>
              <option>Lightroom</option>
              <option>Capture One</option>
              <option>Manual folders</option>
            </select>
          </label>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <label>
            Workflow statuses
            <textarea name="workflowStatuses" required rows={10} defaultValue={workflowStatuses.join("\n")} />
          </label>
          <label>
            Session types
            <textarea name="sessionTypes" required rows={10} defaultValue={sessionTypes.join("\n")} />
          </label>
          <label>
            Retouch types
            <textarea name="retouchTypes" required rows={10} defaultValue={retouchTypes.join("\n")} />
          </label>
          <label>
            Photographers
            <textarea name="photographers" required rows={10} defaultValue={photographers.join("\n")} />
          </label>
        </div>
        <div className="grid gap-3 rounded-xl bg-studio-paper p-4 text-sm text-slate-700 md:grid-cols-2">
          <p>
            Order format examples: <span className="font-semibold">{"{studioCode}-{year}-{sequence4}"}</span>,{" "}
            <span className="font-semibold">{"{studioCode}-{date}-{sequence3}"}</span>.
          </p>
          <p>
            Folder naming examples: <span className="font-semibold">{"{year}/{date}_{customerName}_{orderId}"}</span>,{" "}
            <span className="font-semibold">{"{photographer}/{date}_{customerName}"}</span>.
          </p>
        </div>
        <Button type="submit" variant="primary">Save settings</Button>
      </form>
    </AppShell>
  );
}
