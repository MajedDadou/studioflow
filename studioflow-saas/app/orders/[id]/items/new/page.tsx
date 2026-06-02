import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { addOrderItem } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";
import { formatMoney, safeJsonList } from "@/lib/format";

export default async function NewOrderItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studio, record: order } = await requireStudioRecord((studioId) =>
    prisma.order.findFirst({
      where: { id, studioId },
      include: { customer: true }
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
        title="Add one selected image"
        description={`Add a single selected file or image number to ${order.orderNumber}. Use bulk paste when a customer has chosen several images with the same product settings.`}
        actions={<Button href={`/orders/${order.id}/items/bulk`}>Bulk paste instead</Button>}
      />
      <form action={addOrderItem} className="grid max-w-5xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        {products.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Add at least one active product before adding selected images to an order.
          </div>
        ) : null}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
          Accepts full filenames like IMG_1023.CR3 or simple image numbers like 1025. StudioFlow stores references only; it does not touch original image files.
        </div>
        <input type="hidden" name="orderId" value={order.id} />
        <div className="grid gap-5 md:grid-cols-2">
          <label>Image filename or number
            <input name="imageRef" required placeholder="IMG_1023.CR3 or 1025" />
          </label>
          <label>Product
            <select name="productId" required>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} - {formatMoney(product.price)}</option>)}
            </select>
          </label>
          <label>Frame optional
            <select name="frameId" defaultValue="">
              <option value="">No frame</option>
              {frames.map((frame) => <option key={frame.id} value={frame.id}>{frame.name} - {frame.size} - {formatMoney(frame.price)}</option>)}
            </select>
          </label>
          <label>Quantity<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
          <label>Size<input name="size" placeholder="20x30, 50x70, digital, passport" defaultValue="-" /></label>
          <label>Variant
            <select name="variant" defaultValue="Color" required>
              <option>Color</option>
              <option>Black and white</option>
              <option>Both</option>
            </select>
          </label>
          <label>Retouch type
            <select name="retouchType" defaultValue="None" required>
              {retouchTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>Assign retoucher
            <select name="retoucherId" defaultValue="">
              <option value="">Unassigned</option>
              {retouchers.map((retoucher) => <option key={retoucher.id} value={retoucher.id}>{retoucher.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex-row items-center gap-3 rounded-xl border border-studio-line bg-studio-paper p-4">
            <input name="urgent" type="checkbox" className="h-5 w-5" /> Urgent
          </label>
          <label className="flex-row items-center gap-3 rounded-xl border border-studio-line bg-studio-paper p-4">
            <input name="blackAndWhite" type="checkbox" className="h-5 w-5" /> Black and white
          </label>
        </div>
        <label>Retouch notes<textarea name="retouchNotes" rows={5} placeholder="Remove mark on shirt, clean background, natural skin cleanup" /></label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={products.length === 0}>Add selected image</Button>
          <Button href={`/orders/${order.id}`}>Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
