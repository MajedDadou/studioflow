import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { createFrame, createProduct } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatMoney } from "@/lib/format";

export default async function ProductsPage() {
  const studio = await getActiveStudio();
  const [products, frames] = await Promise.all([
    prisma.product.findMany({ where: { studioId: studio.id }, orderBy: { name: "asc" } }),
    prisma.frame.findMany({ where: { studioId: studio.id }, orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell>
      <PageHeader title="Products and Frames" description="Configure products, prices, and frame options per studio." />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Products</h2>
          <div className="mt-4 grid gap-3">
            {products.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl bg-studio-paper p-4">
                <div>
                  <p className="font-bold text-studio-ink">{product.name}</p>
                  <p className="text-sm text-slate-600">{product.type} · {product.active ? "Active" : "Inactive"}</p>
                </div>
                <p className="font-black text-studio-orangeDark">{formatMoney(product.price)}</p>
              </div>
            ))}
          </div>
          <form action={createProduct} className="mt-5 grid gap-3 rounded-xl border border-studio-line p-4">
            <h3 className="font-black text-studio-ink">Add product</h3>
            <input name="name" required placeholder="Print 30x40" />
            <input name="type" required placeholder="Print, Digital, Retouch, Wall art" />
            <input name="price" required placeholder="299" />
            <label className="flex-row items-center gap-3"><input name="active" type="checkbox" defaultChecked className="h-5 w-5" /> Active</label>
            <Button type="submit" variant="primary">Add product</Button>
          </form>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <h2 className="text-lg font-black text-studio-ink">Frames</h2>
          <div className="mt-4 grid gap-3">
            {frames.map((frame) => (
              <div key={frame.id} className="flex items-center justify-between gap-3 rounded-xl bg-studio-paper p-4">
                <div>
                  <p className="font-bold text-studio-ink">{frame.name}</p>
                  <p className="text-sm text-slate-600">{frame.size} · {frame.color} · {frame.active ? "Active" : "Inactive"}</p>
                </div>
                <p className="font-black text-studio-orangeDark">{formatMoney(frame.price)}</p>
              </div>
            ))}
          </div>
          <form action={createFrame} className="mt-5 grid gap-3 rounded-xl border border-studio-line p-4">
            <h3 className="font-black text-studio-ink">Add frame</h3>
            <input name="name" required placeholder="Black classic frame" />
            <input name="size" required placeholder="30x40" />
            <input name="color" required placeholder="Black" />
            <input name="price" required placeholder="299" />
            <label className="flex-row items-center gap-3"><input name="active" type="checkbox" defaultChecked className="h-5 w-5" /> Active</label>
            <Button type="submit" variant="primary">Add frame</Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
