import { cancelOrderItem, updateOrderItem } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";
import { formatMoney, safeJsonList } from "@/lib/format";

const orderItemStatuses = ["New", "In production", "Ready", "Delivered", "Cancelled", "Inactive"];
const variants = ["Color", "Black and white", "Both"];

export default async function EditOrderItemPage({
  params
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const { studio, record: item } = await requireStudioRecord((studioId) =>
    prisma.orderItem.findFirst({
      where: { id: itemId, orderId: id, order: { studioId } },
      include: {
        order: { include: { customer: true } },
        product: true,
        frame: true,
        retouchTask: true
      }
    })
  );
  const [products, frames, retouchers] = await Promise.all([
    prisma.product.findMany({
      where: { studioId: studio.id, OR: [{ active: true }, { id: item.productId }] },
      orderBy: { name: "asc" }
    }),
    prisma.frame.findMany({
      where: { studioId: studio.id, OR: [{ active: true }, ...(item.frameId ? [{ id: item.frameId }] : [])] },
      orderBy: { name: "asc" }
    }),
    prisma.retoucher.findMany({ where: { studioId: studio.id, active: true }, orderBy: { name: "asc" } })
  ]);
  const retouchTypes = safeJsonList(studio.settings?.retouchTypesJson, ["None", "Standard", "Advanced"]);

  return (
    <AppShell>
      <PageHeader
        title={`Edit ${item.imageRef}`}
        description={`Update product, quantity, frame, and retouch instructions for ${item.order.orderNumber}.`}
      />

      <form action={updateOrderItem.bind(null, item.id)} className="grid max-w-5xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        {item.status === "Cancelled" || item.status === "Inactive" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            This item is currently {item.status}. Change the status back to New, In production, Ready, or Delivered to make it active again.
          </div>
        ) : null}

        <div className="grid gap-5 md:grid-cols-2">
          <label>Image filename or number
            <input name="imageRef" required defaultValue={item.imageRef} />
          </label>
          <label>Status
            <select name="status" required defaultValue={item.status}>
              {orderItemStatuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>Product
            <select name="productId" required defaultValue={item.productId}>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} - {formatMoney(product.price)}</option>)}
            </select>
          </label>
          <label>Frame optional
            <select name="frameId" defaultValue={item.frameId ?? ""}>
              <option value="">No frame</option>
              {frames.map((frame) => <option key={frame.id} value={frame.id}>{frame.name} - {frame.size} - {formatMoney(frame.price)}</option>)}
            </select>
          </label>
          <label>Quantity<input name="quantity" type="number" min="1" required defaultValue={item.quantity} /></label>
          <label>Size<input name="size" required defaultValue={item.size} placeholder="20x30, 50x70, digital, passport" /></label>
          <label>Variant
            <select name="variant" required defaultValue={item.variant}>
              {variants.map((variant) => <option key={variant}>{variant}</option>)}
            </select>
          </label>
          <label>Retouch type
            <select name="retouchType" required defaultValue={item.retouchType}>
              {retouchTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>Assign retoucher
            <select name="retoucherId" defaultValue={item.retouchTask?.assignedRetoucherId ?? ""}>
              <option value="">Unassigned</option>
              {retouchers.map((retoucher) => <option key={retoucher.id} value={retoucher.id}>{retoucher.name}</option>)}
            </select>
          </label>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex-row items-center gap-3 rounded-xl border border-studio-line bg-studio-paper p-4">
            <input name="urgent" type="checkbox" defaultChecked={item.urgent} className="h-5 w-5" /> Urgent
          </label>
          <label className="flex-row items-center gap-3 rounded-xl border border-studio-line bg-studio-paper p-4">
            <input name="blackAndWhite" type="checkbox" defaultChecked={item.blackAndWhite} className="h-5 w-5" /> Black and white
          </label>
        </div>

        <label>Retouch instructions per image
          <textarea name="retouchNotes" rows={5} defaultValue={item.retouchNotes ?? ""} placeholder="Remove mark on shirt, clean background, natural skin cleanup" />
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">Save Item</Button>
          <Button href={`/orders/${item.orderId}`}>Cancel</Button>
        </div>
      </form>

      {item.status !== "Cancelled" && item.status !== "Inactive" ? (
        <form action={cancelOrderItem.bind(null, item.id)} className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="font-black text-red-800">Cancel this item without deleting it</p>
          <p className="mt-1 text-sm text-red-700">
            The item stays in the order history, but it is excluded from the total price and retouch work.
          </p>
          <Button type="submit" variant="danger" className="mt-4">Mark Item Cancelled</Button>
        </form>
      ) : null}
    </AppShell>
  );
}
