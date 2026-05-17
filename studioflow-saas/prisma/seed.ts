import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const workflowStatuses = [
  "Draft",
  "New",
  "Waiting for files",
  "Waiting for retouch",
  "In retouch",
  "Ready for review",
  "Ready for delivery",
  "Delivered",
  "Cancelled"
];

const retouchStatuses = ["Not started", "Sent to retoucher", "In progress", "Needs changes", "Done", "Approved"];
const retouchTypes = ["None", "Standard", "Advanced", "Skin cleanup", "Background cleanup", "Composite"];
const photographers = ["Martin", "Sanne", "Daniel", "Freja"];

function days(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function reset() {
  await prisma.bridgeLog.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.retouchTask.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.photoSession.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.frame.deleteMany();
  await prisma.retoucher.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.studioSettings.deleteMany();
  await prisma.studioSubscription.deleteMany();
  await prisma.studio.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
}

async function seedPlans() {
  return Promise.all(
    [
      {
        name: "Free Trial",
        priceDkk: 0,
        description: "Limited demo usage for trying the workflow.",
        features: ["Max 20 orders", "No real bridge automation", "One user"],
        orderLimit: 20,
        bridgeAutomation: false,
        userLimit: 1,
        sortOrder: 1
      },
      {
        name: "Starter",
        priceDkk: 199,
        description: "Core customer, session, and order workflow.",
        features: ["Customers, sessions, orders", "Manual email templates", "Basic dashboard"],
        orderLimit: null,
        bridgeAutomation: false,
        userLimit: 2,
        sortOrder: 2
      },
      {
        name: "Studio",
        priceDkk: 499,
        description: "Retouch workflow and controlled local bridge automation.",
        features: ["Retouch task management", "Folder automation bridge", "Multiple users", "Custom statuses"],
        orderLimit: null,
        bridgeAutomation: true,
        userLimit: 8,
        sortOrder: 3
      },
      {
        name: "Pro",
        priceDkk: 999,
        description: "Advanced automation for larger studios and multi-location teams.",
        features: ["Multiple locations", "Advanced automation", "Priority support", "Reporting"],
        orderLimit: null,
        bridgeAutomation: true,
        userLimit: 25,
        sortOrder: 4
      }
    ].map((plan) =>
      prisma.subscriptionPlan.create({
        data: {
          name: plan.name,
          priceDkk: plan.priceDkk,
          description: plan.description,
          featuresJson: JSON.stringify(plan.features),
          orderLimit: plan.orderLimit,
          bridgeAutomation: plan.bridgeAutomation,
          userLimit: plan.userLimit,
          sortOrder: plan.sortOrder
        }
      })
    )
  );
}

async function seedStudio(name: string, slug: string, planName: string) {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { name: planName } });
  const studio = await prisma.studio.create({
    data: {
      name,
      slug,
      settings: {
        create: {
          orderIdFormat: slug === "fotograf-guld" ? "FG-{year}-{sequence4}" : "{studioCode}-{year}-{sequence4}",
          defaultFolderPath: "safe-test-folder/StudioFlow_Test",
          folderNamingFormat: "{year}/{date}_{customerName}_{orderId}",
          workflowStatusesJson: JSON.stringify(workflowStatuses),
          retouchTypesJson: JSON.stringify(retouchTypes),
          photographersJson: JSON.stringify(photographers),
          captureTool: slug === "fotograf-guld" ? "Lightroom" : "Capture One"
        }
      },
      subscription: {
        create: {
          planId: plan.id,
          status: "Active"
        }
      },
      employees: {
        create: [
          { name: "Daniel", email: "daniel@example.dk", role: "Owner" },
          { name: "Sanne", email: "sanne@example.dk", role: "Studio Manager" },
          { name: "Martin", email: "martin@example.dk", role: "Photographer" }
        ]
      }
    }
  });

  const products = await Promise.all(
    [
      ["Digital image", "Digital", 14900],
      ["Print 10x15", "Print", 3900],
      ["Print 13x18", "Print", 5900],
      ["Print 20x30", "Print", 14900],
      ["Canvas", "Wall art", 69900],
      ["Framed photo", "Frame bundle", 49900],
      ["Passport photos", "Passport", 19900],
      ["Extra retouch", "Retouch", 24900]
    ].map(([productName, type, price]) =>
      prisma.product.create({
        data: { studioId: studio.id, name: String(productName), type: String(type), price: Number(price), active: true }
      })
    )
  );

  const frames = await Promise.all(
    [
      ["White oak frame", "20x30", "White", 19900],
      ["Black classic frame", "30x40", "Black", 29900],
      ["Gold gallery frame", "50x70", "Gold", 44900]
    ].map(([frameName, size, color, price]) =>
      prisma.frame.create({
        data: { studioId: studio.id, name: String(frameName), size: String(size), color: String(color), price: Number(price), active: true }
      })
    )
  );

  const retouchers = await Promise.all(
    [
      ["Nadhif", "nadhif@example.dk", "Portrait retouch and cleanup"],
      ["Marija", "marija@example.dk", "Advanced background and composite work"],
      ["Line", "line@example.dk", "Fast print-ready edits"]
    ].map(([retoucherName, email, notes]) =>
      prisma.retoucher.create({
        data: { studioId: studio.id, name: retoucherName, email, notes, active: true }
      })
    )
  );

  await prisma.emailTemplate.createMany({
    data: [
      {
        studioId: studio.id,
        name: "Retouch task email",
        type: "Retouch",
        subject: "Retouch task {orderId} - {customerName}",
        body:
          "Hi,\n\nA retouch order is ready.\n\nOrder: {orderId}\nCustomer/session: {customerName} - {sessionType}\nDeadline: {deadline}\nFolder: {folderPath}\n\nRetouch instructions:\n{retouchLines}\n\nInternal notes:\n{internalNotes}\n",
        active: true
      },
      {
        studioId: studio.id,
        name: "Customer order confirmation",
        type: "Customer confirmation",
        subject: "Order confirmation {orderId}",
        body:
          "Hi {customerName},\n\nThank you for your order.\n\nOrder: {orderId}\nTotal: {orderTotal}\n\nProducts:\n{productLines}\n\nWe will contact you when everything is ready.\n",
        active: true
      },
      {
        studioId: studio.id,
        name: "Order ready for pickup/delivery",
        type: "Ready",
        subject: "Your photos are ready - {orderId}",
        body:
          "Hi {customerName},\n\nYour order {orderId} is ready for pickup/delivery.\n\nBest regards,\nStudioFlow demo studio\n",
        active: true
      },
      {
        studioId: studio.id,
        name: "Internal note",
        type: "Internal",
        subject: "Internal note for {orderId}",
        body: "Order: {orderId}\nCustomer: {customerName}\nNotes:\n{internalNotes}\n",
        active: true
      }
    ]
  });

  const customerData = [
    ["Familien Hansen", "12 34 56 78", "hansen@example.dk", "Comes back for yearly family photos."],
    ["Mette Larsen", "22 45 88 10", "mette@example.dk", "Prefers black and white portraits."],
    ["Nordic Bakery", "70 20 30 40", "hello@nordicbakery.dk", "Product shots for seasonal campaigns."],
    ["Skovgaard Efterskole", "86 12 12 12", "kontor@skovgaard.dk", "School photo contact: Anne."],
    ["Jonas og Amalie", "41 90 20 12", "jonas-amalie@example.dk", "Wedding album follow-up needed."]
  ];

  const customers = await Promise.all(
    customerData.map(([customerName, phone, email, notes]) =>
      prisma.customer.create({
        data: { studioId: studio.id, name: customerName, phone, email, notes }
      })
    )
  );

  const sessions = await Promise.all(
    [
      [0, "Family shoot", "Martin", -1, "safe-test-folder/StudioFlow_Test/2026/Familien_Hansen"],
      [1, "Portrait", "Sanne", 0, "safe-test-folder/StudioFlow_Test/2026/Mette_Larsen"],
      [2, "Product photo", "Daniel", 1, "safe-test-folder/StudioFlow_Test/2026/Nordic_Bakery"],
      [3, "School photo", "Freja", -8, "safe-test-folder/StudioFlow_Test/2026/Skovgaard_Efterskole"],
      [4, "Wedding", "Martin", -14, "safe-test-folder/StudioFlow_Test/2026/Jonas_Amalie"]
    ].map(([customerIndex, sessionType, photographer, offset, folderPath]) =>
      prisma.photoSession.create({
        data: {
          studioId: studio.id,
          customerId: customers[Number(customerIndex)].id,
          sessionType: String(sessionType),
          photographer: String(photographer),
          date: days(Number(offset)),
          folderPath: String(folderPath),
          status: "New",
          notes: "Demo session imported from StudioFlow seed data."
        }
      })
    )
  );

  const orderSpecs = [
    [0, "FG-2026-0001", "Waiting for retouch", "Partly paid", 3],
    [0, "FG-2026-0002", "Ready for delivery", "Paid", 6],
    [1, "FG-2026-0003", "In retouch", "Not paid", 2],
    [2, "FG-2026-0004", "Ready for review", "Paid", 5],
    [3, "FG-2026-0005", "Waiting for files", "Not paid", 4],
    [3, "FG-2026-0006", "Delivered", "Paid", -2],
    [4, "FG-2026-0007", "New", "Partly paid", 10],
    [4, "FG-2026-0008", "Cancelled", "Refunded", null]
  ] as const;

  const orders = [];
  for (const [sessionIndex, orderNumber, status, paymentStatus, deadlineOffset] of orderSpecs) {
    const session = sessions[sessionIndex];
    orders.push(
      await prisma.order.create({
        data: {
          studioId: studio.id,
          sessionId: session.id,
          customerId: session.customerId,
          orderNumber: slug === "fotograf-guld" ? orderNumber : orderNumber.replace("FG", "DPS"),
          deadline: deadlineOffset === null ? null : days(deadlineOffset),
          status,
          paymentStatus,
          internalNotes: "Check retouch comments before final delivery.",
          customerNotes: "Customer wants a simple selection summary."
        }
      })
    );
  }

  const itemSpecs = [
    [0, "IMG_1023.CR3", 3, 0, 2, "30x40", "Color", "Standard", "Remove mark on shirt", true, false, 0],
    [0, "IMG_1024.CR3", 0, null, 1, "-", "Color", "None", "", false, false, null],
    [0, "1025", 4, null, 1, "50x70", "Both", "Advanced", "Clean background", true, true, 1],
    [1, "IMG_1101.CR3", 1, null, 4, "10x15", "Color", "None", "", false, false, null],
    [1, "IMG_1102.CR3", 2, null, 2, "13x18", "Black and white", "Standard", "Soft skin cleanup", false, true, 2],
    [2, "IMG_2001.CR3", 0, null, 1, "-", "Black and white", "Skin cleanup", "Natural skin only", false, true, 0],
    [2, "IMG_2002.CR3", 6, null, 1, "Passport", "Color", "None", "", false, false, null],
    [3, "BAKERY_001.CR3", 0, null, 1, "-", "Color", "Background cleanup", "Remove crumbs from table", true, false, 1],
    [3, "BAKERY_002.CR3", 0, null, 1, "-", "Color", "Background cleanup", "Keep natural shadows", false, false, 1],
    [3, "BAKERY_003.CR3", 0, null, 1, "-", "Color", "None", "", false, false, null],
    [4, "SCHOOL_011.CR3", 1, null, 20, "10x15", "Color", "None", "", false, false, null],
    [4, "SCHOOL_012.CR3", 1, null, 20, "10x15", "Color", "Standard", "Fix flyaway hair", false, false, 2],
    [5, "SCHOOL_100.CR3", 2, null, 10, "13x18", "Color", "None", "", false, false, null],
    [5, "SCHOOL_101.CR3", 6, null, 5, "Passport", "Color", "None", "", false, false, null],
    [6, "WED_4001.CR3", 5, 1, 1, "30x40", "Color", "Advanced", "Retouch background guests", true, false, 1],
    [6, "WED_4002.CR3", 4, null, 1, "50x70", "Black and white", "Standard", "Dodge and burn", false, true, 0],
    [6, "WED_4003.CR3", 0, null, 8, "-", "Color", "None", "", false, false, null],
    [7, "WED_4100.CR3", 0, null, 1, "-", "Color", "None", "", false, false, null],
    [7, "WED_4101.CR3", 7, null, 1, "-", "Color", "Advanced", "Cancelled order test item", false, false, 2],
    [7, "WED_4102.CR3", 2, null, 2, "13x18", "Color", "None", "", false, false, null]
  ] as const;

  for (const [orderIndex, imageRef, productIndex, frameIndex, quantity, size, variant, retouchType, retouchNotes, urgent, bw, retoucherIndex] of itemSpecs) {
    const order = orders[orderIndex];
    const product = products[productIndex];
    const frame = frameIndex === null ? null : frames[frameIndex];
    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        imageRef,
        productId: product.id,
        frameId: frame?.id ?? null,
        quantity,
        size,
        variant,
        retouchType,
        retouchNotes: retouchNotes || null,
        urgent,
        blackAndWhite: bw,
        status: "New"
      }
    });
    if (retouchType !== "None") {
      await prisma.retouchTask.create({
        data: {
          studioId: studio.id,
          orderItemId: item.id,
          assignedRetoucherId: retoucherIndex === null ? null : retouchers[retoucherIndex].id,
          retouchType,
          notes: retouchNotes || null,
          deadline: order.deadline,
          urgent,
          status: retouchStatuses[(orderIndex + productIndex) % retouchStatuses.length]
        }
      });
    }
  }

  for (const order of orders) {
    const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, include: { product: true, frame: true } });
    const total = items.reduce((sum, item) => sum + (item.product.price + (item.frame?.price ?? 0)) * item.quantity, 0);
    await prisma.order.update({ where: { id: order.id }, data: { totalPrice: total } });
  }

  await prisma.activity.createMany({
    data: [
      { studioId: studio.id, message: "Seed data created with demo customers and orders." },
      { studioId: studio.id, message: "Retouch tasks generated for urgent demo images." },
      { studioId: studio.id, message: "Local bridge simulator is ready in dry-run mode." }
    ]
  });
}

async function main() {
  await reset();
  await seedPlans();
  await seedStudio("Fotograf Guld", "fotograf-guld", "Studio");
  await seedStudio("Demo Portrait Studio", "demo-portrait-studio", "Free Trial");
  console.log("StudioFlow seed data created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
