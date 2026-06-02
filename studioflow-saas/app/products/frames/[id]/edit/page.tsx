import { updateFrame } from "@/app/actions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { formatMoney } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireStudioRecord } from "@/lib/studio";

function priceInputValue(cents: number) {
  return String(cents / 100);
}

export default async function EditFramePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { record: frame } = await requireStudioRecord((studioId) =>
    prisma.frame.findFirst({ where: { id, studioId } })
  );

  return (
    <AppShell>
      <PageHeader
        title="Edit Frame"
        description={`Update ${frame.name}. Current price is ${formatMoney(frame.price)}.`}
      />
      <form action={updateFrame.bind(null, frame.id)} className="grid max-w-3xl gap-5 rounded-2xl border border-studio-line bg-white p-6 shadow-soft">
        <div className="grid gap-5 md:grid-cols-2">
          <label>
            Frame name
            <input name="name" required defaultValue={frame.name} />
          </label>
          <label>
            Size
            <input name="size" required defaultValue={frame.size} placeholder="30x40" />
          </label>
          <label>
            Color
            <input name="color" required defaultValue={frame.color} placeholder="Black" />
          </label>
          <label>
            Price
            <input name="price" required inputMode="decimal" defaultValue={priceInputValue(frame.price)} />
          </label>
          <label className="flex-row items-center gap-3">
            <input name="active" type="checkbox" defaultChecked={frame.active} className="h-5 w-5" /> Active
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">
            Save Frame
          </Button>
          <Button href="/products">Cancel</Button>
        </div>
      </form>
    </AppShell>
  );
}
