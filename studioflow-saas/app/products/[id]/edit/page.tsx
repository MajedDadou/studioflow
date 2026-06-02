import { updateProduct } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { formatMoney, safeJsonList } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";

function priceInputValue(cents: number) {
  return String(cents / 100);
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { record: product } = await requireStudioRecord((studioId) =>
    prisma.product.findFirst({ where: { id, studioId } })
  );
  const sizeOptions = safeJsonList(product.sizeOptionsJson, ["-"]);

  return (
    <AppShell>
      <PageHeader
        title="Edit Product"
        description={`Update ${product.name}. Current price is ${formatMoney(product.price)}.`}
      />
      <form action={updateProduct.bind(null, product.id)} className="grid max-w-3xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="grid gap-5 md:grid-cols-2">
          <label>
            Product name
            <input name="name" required defaultValue={product.name} />
          </label>
          <label>
            Product type
            <input name="type" required defaultValue={product.type} placeholder="Print, Digital, Retouch, Wall art" />
          </label>
          <label>
            Price
            <input name="price" required inputMode="decimal" defaultValue={priceInputValue(product.price)} />
          </label>
          <label className="flex-row items-center gap-3">
            <input name="active" type="checkbox" defaultChecked={product.active} className="h-5 w-5" /> Active
          </label>
        </div>
        <label>
          Default size options
          <textarea name="sizeOptions" required rows={6} defaultValue={sizeOptions.join("\n")} />
          <span className="text-xs font-semibold text-slate-500">
            Add one option per line. Use "-" when size is not relevant.
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">
            Save Product
          </Button>
          <Button href="/products">Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
