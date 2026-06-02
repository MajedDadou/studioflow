import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { createRetoucher } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";

export default async function RetouchersPage() {
  const studio = await getActiveStudio();
  const retouchers = await prisma.retoucher.findMany({
    where: { studioId: studio.id },
    orderBy: { name: "asc" },
    include: { tasks: { where: { studioId: studio.id } } }
  });

  return (
    <AppShell>
      <PageHeader title="Retouchers" description="Manage internal or external retouchers and see assigned task load." />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="grid gap-4">
          {retouchers.map((retoucher) => (
            <article key={retoucher.id} className="rounded-2xl border border-studio-line bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-studio-ink">{retoucher.name}</p>
                  <p className="text-sm text-slate-600">{retoucher.email} · {retoucher.phone ?? "No phone"}</p>
                  <p className="mt-2 text-sm text-slate-600">{retoucher.notes ?? "No notes"}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-studio-orange">{retoucher.tasks.length}</p>
                  <p className="text-xs font-bold uppercase text-slate-500">tasks</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <form action={createRetoucher} className="grid content-start gap-4 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Add retoucher</h2>
          <input name="name" required placeholder="Retoucher name" />
          <input name="email" required type="email" placeholder="retoucher@example.dk" />
          <input name="phone" placeholder="Optional phone" />
          <textarea name="notes" rows={4} placeholder="Specialty, capacity, language, delivery notes" />
          <label className="flex-row items-center gap-3"><input name="active" type="checkbox" defaultChecked className="h-5 w-5" /> Active</label>
          <Button type="submit" variant="primary">Add retoucher</Button>
        </form>
      </div>
    </AppShell>
  );
}
