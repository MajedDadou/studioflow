import { bulkAddOrderItems } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";
import { formatMoney, safeJsonList } from "@/lib/format";

export default async function BulkOrderItemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studio, record: order } = await requireStudioRecord((studioId) =>
    prisma.order.findFirst({
      where: { id, studioId },
      include: { customer: true, items: true }
    })
  );

  const [products, frames, retouchers] = await Promise.all([
    prisma.product.findMany({ where: { studioId: order.studioId, active: true }, orderBy: { name: "asc" } }),
    prisma.frame.findMany({ where: { studioId: order.studioId, active: true }, orderBy: { name: "asc" } }),
    prisma.retoucher.findMany({ where: { studioId: order.studioId, active: true }, orderBy: { name: "asc" } })
  ]);
  const retouchTypes = safeJsonList(studio.settings?.retouchTypesJson, ["None", "Standard", "Advanced"]);

  return (
    <AppShell>
      <PageHeader
        title="Bulk add selected images"
        description={`Paste multiple selected image filenames or numbers for ${order.orderNumber}. They will all use the same product settings below.`}
      />

      <form action={bulkAddOrderItems} className="grid max-w-6xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        {products.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Add at least one active product before bulk adding selected images.
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-studio-ink">
            <p className="font-black">Fast entry for a customer selection session</p>
            <p className="mt-1 text-slate-700">
              Paste one image per line, or separate them with spaces, commas, or semicolons. StudioFlow stores references only and never touches original image files.
            </p>
          </div>
          <div className="rounded-xl bg-studio-paper p-4 text-sm">
            <p className="font-black text-studio-ink">Current order</p>
            <p className="mt-1 text-slate-600">{order.customer.name}</p>
            <p className="text-slate-600">{order.items.length} image items already added</p>
          </div>
        </div>

        <input type="hidden" name="orderId" value={order.id} />

        <label>
          Image filenames or numbers
          <textarea
            name="imageRefs"
            rows={9}
            required
            placeholder={"IMG_1023.CR3\nIMG_1024.CR3\n1025\n1026"}
            className="font-mono text-sm"
          />
        </label>

        <div className="grid gap-5 md:grid-cols-2">
          <label>
            Product
            <select name="productId" required>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {formatMoney(product.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Frame optional
            <select name="frameId" defaultValue="">
              <option value="">No frame</option>
              {frames.map((frame) => (
                <option key={frame.id} value={frame.id}>
                  {frame.name} - {frame.size} - {formatMoney(frame.price)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity per image
            <input name="quantity" type="number" min="1" defaultValue="1" required />
          </label>
          <label>
            Size
            <input name="size" placeholder="20x30, 50x70, digital, passport" defaultValue="-" />
          </label>
          <label>
            Variant
            <select name="variant" defaultValue="Color" required>
              <option>Color</option>
              <option>Black and white</option>
              <option>Both</option>
            </select>
          </label>
          <label>
            Retouch type
            <select name="retouchType" defaultValue="None" required>
              {retouchTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            Assign retoucher
            <select name="retoucherId" defaultValue="">
              <option value="">Unassigned</option>
              {retouchers.map((retoucher) => (
                <option key={retoucher.id} value={retoucher.id}>
                  {retoucher.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex-row items-center gap-3 rounded-xl border border-studio-line bg-studio-paper p-4">
            <input name="urgent" type="checkbox" className="h-5 w-5" /> Mark all as urgent
          </label>
          <label className="flex-row items-center gap-3 rounded-xl border border-studio-line bg-studio-paper p-4">
            <input name="blackAndWhite" type="checkbox" className="h-5 w-5" /> Also mark as black and white
          </label>
        </div>

        <label>
          Shared retouch notes
          <textarea name="retouchNotes" rows={5} placeholder="Use only if the same instruction applies to all pasted images." />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={products.length === 0}>Add pasted images</Button>
          <Button href={`/orders/${order.id}`}>Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
