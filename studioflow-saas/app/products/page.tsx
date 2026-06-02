import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { createFrame, createProduct, toggleFrameActive, toggleProductActive } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { getActiveStudio } from "@/lib/studio";
import { formatMoney, safeJsonList } from "@/lib/format";

export default async function ProductsPage() {
  const studio = await getActiveStudio();
  const [products, frames] = await Promise.all([
    prisma.product.findMany({ where: { studioId: studio.id }, orderBy: { name: "asc" } }),
    prisma.frame.findMany({ where: { studioId: studio.id }, orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell>
      <PageHeader
        title="Products and Frames"
        description="Configure active products, prices, size options, and frame choices for this studio only."
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-studio-ink">Products</h2>
              <p className="text-sm text-slate-600">
                {products.filter((product) => product.active).length} active,{" "}
                {products.filter((product) => !product.active).length} inactive
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {products.length === 0 ? (
              <p className="rounded-xl bg-studio-paper p-4 text-sm font-semibold text-slate-600">
                No products yet. Add the first product below.
              </p>
            ) : (
              products.map((product) => {
                const sizes = safeJsonList(product.sizeOptionsJson, []);
                return (
                  <div key={product.id} className="rounded-xl bg-studio-paper p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-studio-ink">{product.name}</p>
                        <p className="text-sm text-slate-600">
                          {product.type} - {formatMoney(product.price)}
                        </p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sizes</p>
                        <p className="mt-1 text-sm text-slate-700">{sizes.length ? sizes.join(", ") : "No default sizes"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            product.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {product.active ? "Active" : "Inactive"}
                        </span>
                        <Button href={`/products/${product.id}/edit`} variant="secondary">
                          Edit
                        </Button>
                        <form action={toggleProductActive.bind(null, product.id)}>
                          <Button type="submit" variant={product.active ? "danger" : "primary"}>
                            {product.active ? "Deactivate" : "Activate"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form action={createProduct} className="mt-5 grid gap-3 rounded-xl border border-studio-line p-4">
            <h3 className="font-black text-studio-ink">Add product</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="name" required placeholder="Print 30x40" />
              <input name="type" required placeholder="Print, Digital, Retouch, Wall art" />
              <input name="price" required inputMode="decimal" placeholder="299" />
              <label className="flex-row items-center gap-3">
                <input name="active" type="checkbox" defaultChecked className="h-5 w-5" /> Active
              </label>
              <label className="md:col-span-2">
                Default size options
                <textarea name="sizeOptions" required rows={4} placeholder={"-\n10x15\n13x18\n20x30"} />
              </label>
            </div>
            <Button type="submit" variant="primary">
              Add product
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-studio-ink">Frames</h2>
              <p className="text-sm text-slate-600">
                {frames.filter((frame) => frame.active).length} active,{" "}
                {frames.filter((frame) => !frame.active).length} inactive
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {frames.length === 0 ? (
              <p className="rounded-xl bg-studio-paper p-4 text-sm font-semibold text-slate-600">
                No frames yet. Add the first frame below.
              </p>
            ) : (
              frames.map((frame) => (
                <div key={frame.id} className="rounded-xl bg-studio-paper p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-studio-ink">{frame.name}</p>
                      <p className="text-sm text-slate-600">
                        {frame.size} - {frame.color} - {formatMoney(frame.price)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          frame.active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {frame.active ? "Active" : "Inactive"}
                      </span>
                      <Button href={`/products/frames/${frame.id}/edit`} variant="secondary">
                        Edit
                      </Button>
                      <form action={toggleFrameActive.bind(null, frame.id)}>
                        <Button type="submit" variant={frame.active ? "danger" : "primary"}>
                          {frame.active ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <form action={createFrame} className="mt-5 grid gap-3 rounded-xl border border-studio-line p-4">
            <h3 className="font-black text-studio-ink">Add frame</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <input name="name" required placeholder="Black classic frame" />
              <input name="size" required placeholder="30x40" />
              <input name="color" required placeholder="Black" />
              <input name="price" required inputMode="decimal" placeholder="299" />
              <label className="flex-row items-center gap-3">
                <input name="active" type="checkbox" defaultChecked className="h-5 w-5" /> Active
              </label>
            </div>
            <Button type="submit" variant="primary">
              Add frame
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
