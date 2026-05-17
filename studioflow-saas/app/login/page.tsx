import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import { getActiveStudio, getStudios } from "@/lib/studio";
import { switchStudio } from "@/app/actions";

export default async function LoginPage() {
  const [activeStudio, studios] = await Promise.all([getActiveStudio(), getStudios()]);

  return (
    <AppShell>
      <PageHeader
        title="Fake login and studio switcher"
        description="Authentication is simulated for this MVP. Choose a demo studio and continue testing the workflow."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {studios.map((studio) => (
          <form key={studio.id} action={switchStudio} className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
            <input type="hidden" name="studioId" value={studio.id} />
            <p className="text-lg font-black text-studio-ink">{studio.name}</p>
            <p className="mt-2 text-sm text-slate-600">
              Plan: {studio.subscription?.plan.name ?? "No plan"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Status: {activeStudio.id === studio.id ? "Currently active" : "Available demo studio"}
            </p>
            <Button type="submit" variant={activeStudio.id === studio.id ? "secondary" : "primary"} className="mt-5">
              Use this studio
            </Button>
          </form>
        ))}
      </div>
    </AppShell>
  );
}
