import Link from "next/link";
import { getActiveStudio, getStudios } from "@/lib/studio";
import { StudioSwitcher } from "@/components/StudioSwitcher";
import { NavLinks } from "@/components/NavLinks";

export async function Sidebar() {
  const [studio, studios] = await Promise.all([getActiveStudio(), getStudios()]);

  return (
    <aside className="shrink-0 border-b border-studio-line bg-white p-4 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:flex-col lg:border-b-0 lg:border-r lg:p-5">
      <Link href="/" className="mb-5 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-studio-orange text-sm font-black text-white">
          SF
        </span>
        <span>
          <span className="block text-lg font-black tracking-normal text-studio-ink">StudioFlow</span>
          <span className="block text-xs font-semibold text-slate-500">Order and retouch workflow</span>
        </span>
      </Link>

      <StudioSwitcher studios={studios} activeStudioId={studio.id} />

      <NavLinks />

      <div className="mt-5 rounded-2xl bg-studio-paper p-4 text-sm lg:mt-auto">
        <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
          Safe MVP mode
        </div>
        <p className="font-bold text-studio-ink">{studio.name}</p>
        <p className="mt-1 text-slate-600">{studio.subscription?.plan.name ?? "No plan"} plan</p>
      </div>
    </aside>
  );
}
