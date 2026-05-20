import { prisma } from "../lib/prisma";

async function countOrFail(label: string, count: number, minimum: number) {
  if (count < minimum) {
    throw new Error(`${label} expected at least ${minimum}, found ${count}`);
  }
  console.log(`${label}: ${count}`);
}

async function main() {
  const [
    studios,
    customers,
    sessions,
    orders,
    orderItems,
    products,
    retouchers,
    retouchTasks,
    emailTemplates,
    plans
  ] = await Promise.all([
    prisma.studio.count(),
    prisma.customer.count(),
    prisma.photoSession.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
    prisma.product.count(),
    prisma.retoucher.count(),
    prisma.retouchTask.count(),
    prisma.emailTemplate.count(),
    prisma.subscriptionPlan.count()
  ]);

  await countOrFail("Studios", studios, 2);
  await countOrFail("Customers", customers, 5);
  await countOrFail("Sessions", sessions, 5);
  await countOrFail("Orders", orders, 8);
  await countOrFail("Selected image items", orderItems, 20);
  await countOrFail("Products", products, 5);
  await countOrFail("Retouchers", retouchers, 3);
  await countOrFail("Retouch tasks", retouchTasks, 1);
  await countOrFail("Email templates", emailTemplates, 4);
  await countOrFail("Subscription plans", plans, 4);

  const orderWithItems = await prisma.order.findFirst({
    where: { items: { some: {} } },
    include: { customer: true, session: true, items: { include: { product: true } } }
  });
  if (!orderWithItems) {
    throw new Error("No order with selected image items found");
  }

  console.log(
    `Workflow sample: ${orderWithItems.orderNumber} for ${orderWithItems.customer.name} has ${orderWithItems.items.length} selected image items.`
  );
  console.log("StudioFlow smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
