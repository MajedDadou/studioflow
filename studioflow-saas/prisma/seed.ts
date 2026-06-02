import { PrismaClient, type Permission, type Role, type SubscriptionPlan, type User } from "@prisma/client";

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

const paymentStatuses = ["Not paid", "Partly paid", "Paid", "Refunded"];
const retouchStatuses = ["Not started", "Sent to retoucher", "In progress", "Needs changes", "Done", "Approved"];
const retouchTypes = ["None", "Standard", "Advanced", "Skin cleanup", "Background cleanup", "Composite"];
const sessionTypes = ["Family shoot", "Passport photo", "Portrait", "Wedding", "Product photo", "School photo", "Other"];
const photographers = ["Martin", "Sanne", "Daniel", "Freja"];

const permissionDefinitions = [
  ["customers.read", "View customers"],
  ["customers.write", "Create and edit customers"],
  ["sessions.write", "Create and edit sessions"],
  ["orders.write", "Create and edit orders"],
  ["retouch.manage", "Manage retouch tasks"],
  ["settings.manage", "Manage studio settings"],
  ["billing.manage", "Manage billing"],
  ["bridge.manage", "Manage local bridge jobs"]
] as const;

function days(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function reset() {
  await prisma.dataExport.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.paymentCustomer.deleteMany();
  await prisma.generatedFile.deleteMany();
  await prisma.bridgeLog.deleteMany();
  await prisma.bridgeJob.deleteMany();
  await prisma.bridgeAgent.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.productionTask.deleteMany();
  await prisma.retouchTask.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.orderStatus.deleteMany();
  await prisma.sessionImageReference.deleteMany();
  await prisma.photoSession.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.frame.deleteMany();
  await prisma.retoucher.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.studioSettings.deleteMany();
  await prisma.studioMember.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.studioSubscription.deleteMany();
  await prisma.studioLocation.deleteMany();
  await prisma.studio.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
}

async function seedPlans() {
  const plans = [
    {
      name: "Free Trial",
      priceDkk: 0,
      billingInterval: "month",
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
      billingInterval: "month",
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
      billingInterval: "month",
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
      billingInterval: "month",
      description: "Advanced automation for larger studios and multi-location teams.",
      features: ["Multiple locations", "Advanced automation", "Priority support", "Reporting"],
      orderLimit: null,
      bridgeAutomation: true,
      userLimit: 25,
      sortOrder: 4
    }
  ];

  const created = await Promise.all(
    plans.map(({ features, ...plan }) =>
      prisma.subscriptionPlan.create({
        data: {
          ...plan,
          featuresJson: JSON.stringify(features)
        }
      })
    )
  );

  return new Map(created.map((plan) => [plan.name, plan]));
}

async function seedPermissions() {
  const permissions = await Promise.all(
    permissionDefinitions.map(([key, label]) => prisma.permission.create({ data: { key, label } }))
  );
  return new Map(permissions.map((permission) => [permission.key, permission]));
}

async function seedUsers() {
  const users = await Promise.all([
    prisma.user.create({ data: { name: "Daniel", email: "daniel@studioflow.test", authProviderId: "dev_daniel" } }),
    prisma.user.create({ data: { name: "Sanne", email: "sanne@studioflow.test", authProviderId: "dev_sanne" } }),
    prisma.user.create({ data: { name: "Martin", email: "martin@studioflow.test", authProviderId: "dev_martin" } }),
    prisma.user.create({ data: { name: "Emma Demo", email: "emma@studioflow.test", authProviderId: "dev_emma" } }),
    prisma.user.create({ data: { name: "Oliver Demo", email: "oliver@studioflow.test", authProviderId: "dev_oliver" } })
  ]);

  return {
    daniel: users[0],
    sanne: users[1],
    martin: users[2],
    emma: users[3],
    oliver: users[4]
  };
}

type SeedUsers = {
  daniel: User;
  sanne: User;
  martin: User;
  emma: User;
  oliver: User;
};

async function createRoles(studioId: string, permissionMap: Map<string, Permission>) {
  const roleSpecs = [
    {
      name: "Owner",
      description: "Full studio and billing access",
      permissions: permissionDefinitions.map(([key]) => key)
    },
    {
      name: "Studio Manager",
      description: "Operational access for daily workflow",
      permissions: ["customers.read", "customers.write", "sessions.write", "orders.write", "retouch.manage", "bridge.manage"]
    },
    {
      name: "Photographer",
      description: "Session, order, and customer workflow access",
      permissions: ["customers.read", "sessions.write", "orders.write"]
    },
    {
      name: "Retoucher",
      description: "Retouch task access",
      permissions: ["customers.read", "retouch.manage"]
    }
  ];

  const roles = new Map<string, Role>();
  for (const spec of roleSpecs) {
    const role = await prisma.role.create({
      data: { studioId, name: spec.name, description: spec.description }
    });
    roles.set(spec.name, role);
    await prisma.rolePermission.createMany({
      data: spec.permissions.map((key) => ({
        roleId: role.id,
        permissionId: permissionMap.get(key)!.id
      }))
    });
  }
  return roles;
}

async function seedStudio({
  name,
  slug,
  planName,
  captureTool,
  users,
  permissionMap,
  planMap
}: {
  name: string;
  slug: string;
  planName: string;
  captureTool: string;
  users: SeedUsers;
  permissionMap: Map<string, Permission>;
  planMap: Map<string, SubscriptionPlan>;
}) {
  const plan = planMap.get(planName);
  if (!plan) throw new Error(`Missing plan ${planName}`);

  const studio = await prisma.studio.create({
    data: {
      name,
      slug,
      country: "DK",
      timezone: "Europe/Copenhagen",
      settings: {
        create: {
          orderIdFormat: slug === "fotograf-guld" ? "FG-{year}-{sequence4}" : "{studioCode}-{year}-{sequence4}",
          defaultFolderPath: "safe-test-folder/StudioFlow_Test",
          folderNamingFormat: "{year}/{date}_{customerName}_{orderId}",
          workflowStatusesJson: JSON.stringify(workflowStatuses),
          sessionTypesJson: JSON.stringify(sessionTypes),
          retouchTypesJson: JSON.stringify(retouchTypes),
          photographersJson: JSON.stringify(photographers),
          captureTool
        }
      },
      subscription: {
        create: {
          planId: plan.id,
          status: "Active",
          trialEndsAt: days(14),
          renewsAt: days(30)
        }
      }
    }
  });

  const location = await prisma.studioLocation.create({
    data: {
      studioId: studio.id,
      name: slug === "fotograf-guld" ? "Fotograf Guld - Aars" : "Demo Portrait Studio - Main",
      address: slug === "fotograf-guld" ? "Aars, Denmark" : "Copenhagen, Denmark",
      defaultFolderPath: `safe-test-folder/StudioFlow_Test/${slug}`
    }
  });

  const roles = await createRoles(studio.id, permissionMap);
  const memberSpecs =
    slug === "fotograf-guld"
      ? [
          [users.daniel.id, "Owner"],
          [users.sanne.id, "Studio Manager"],
          [users.martin.id, "Photographer"]
        ]
      : [
          [users.emma.id, "Owner"],
          [users.oliver.id, "Photographer"],
          [users.sanne.id, "Retoucher"]
        ];

  await prisma.studioMember.createMany({
    data: memberSpecs.map(([userId, roleName]) => ({
      studioId: studio.id,
      userId,
      roleId: roles.get(roleName)!.id,
      active: true
    }))
  });

  const orderStatuses = await Promise.all(
    workflowStatuses.map((status, index) =>
      prisma.orderStatus.create({
        data: {
          studioId: studio.id,
          name: status,
          sortOrder: index + 1,
          color: ["Delivered", "Ready for delivery"].includes(status) ? "green" : status === "Cancelled" ? "gray" : "orange",
          isFinal: ["Delivered", "Cancelled"].includes(status)
        }
      })
    )
  );
  const statusMap = new Map(orderStatuses.map((status) => [status.name, status]));

  const products = await Promise.all(
    [
      ["Digital image", "Digital", 14900, ["digital"]],
      ["Print 10x15", "Print", 3900, ["10x15"]],
      ["Print 13x18", "Print", 5900, ["13x18"]],
      ["Print 20x30", "Print", 14900, ["20x30"]],
      ["Canvas", "Wall art", 69900, ["30x40", "50x70"]],
      ["Framed photo", "Frame bundle", 49900, ["20x30", "30x40", "50x70"]],
      ["Passport photos", "Passport", 19900, ["passport"]],
      ["Extra retouch", "Retouch", 24900, ["per image"]]
    ].map(([productName, type, price, sizes]) =>
      prisma.product.create({
        data: {
          studioId: studio.id,
          name: String(productName),
          type: String(type),
          price: Number(price),
          sizeOptionsJson: JSON.stringify(sizes),
          active: true
        }
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

  const emailTemplates = await Promise.all(
    [
      {
        name: "Retouch task email",
        type: "Retouch task email",
        subject: "Retouch task {orderId} - {customerName}",
        body:
          "Hi,\n\nA retouch order is ready.\n\nOrder: {orderId}\nCustomer/session: {customerName} - {sessionType}\nDeadline: {deadline}\nFolder: {folderPath}\nAssigned retoucher(s): {assignedRetouchers}\n\nSelected images:\n{selectedImages}\n\nRetouch instructions:\n{retouchInstructions}\n\nInternal notes:\n{internalNotes}\n"
      },
      {
        name: "Customer order confirmation",
        type: "Customer order confirmation",
        subject: "Order confirmation {orderId}",
        body:
          "Hi {customerName},\n\nThank you for your order.\n\nOrder: {orderId}\nTotal: {orderTotal}\n\nProducts:\n{productLines}\n\nWe will contact you when everything is ready.\n"
      },
      {
        name: "Order ready for pickup/delivery",
        type: "Order ready for pickup/delivery",
        subject: "Your photos are ready - {orderId}",
        body: "Hi {customerName},\n\nYour order {orderId} is ready for pickup/delivery.\n\nBest regards,\nStudioFlow demo studio\n"
      },
      {
        name: "Internal note",
        type: "Internal note",
        subject: "Internal note for {orderId}",
        body: "Order: {orderId}\nCustomer: {customerName}\nNotes:\n{internalNotes}\n"
      }
    ].map((template) => prisma.emailTemplate.create({ data: { studioId: studio.id, active: true, ...template } }))
  );

  const customerData = [
    ["Familien Hansen", "12 34 56 78", "hansen@example.dk", "Comes back for yearly family photos.", "Marketing ok"],
    ["Mette Larsen", "22 45 88 10", "mette@example.dk", "Prefers black and white portraits.", "Unknown"],
    ["Nordic Bakery", "70 20 30 40", "hello@nordicbakery.dk", "Product shots for seasonal campaigns.", "Business contact"],
    ["Skovgaard Efterskole", "86 12 12 12", "kontor@skovgaard.dk", "School photo contact: Anne.", "Contract"],
    ["Jonas og Amalie", "41 90 20 12", "jonas-amalie@example.dk", "Wedding album follow-up needed.", "Marketing ok"]
  ];

  const customers = await Promise.all(
    customerData.map(([customerName, phone, email, notes, consentStatus]) =>
      prisma.customer.create({
        data: { studioId: studio.id, name: customerName, phone, email, notes, consentStatus }
      })
    )
  );

  const sessionSpecs = [
    [0, "Family shoot", "Martin", users.martin.id, -1, "Familien_Hansen"],
    [1, "Portrait", "Sanne", users.sanne.id, 0, "Mette_Larsen"],
    [2, "Product photo", "Daniel", users.daniel.id, 1, "Nordic_Bakery"],
    [3, "School photo", "Freja", null, -8, "Skovgaard_Efterskole"],
    [4, "Wedding", "Martin", users.martin.id, -14, "Jonas_Amalie"]
  ] as const;

  const sessions = [];
  for (const [customerIndex, sessionType, photographer, photographerUserId, offset, folderName] of sessionSpecs) {
    const session = await prisma.photoSession.create({
      data: {
        studioId: studio.id,
        customerId: customers[customerIndex].id,
        locationId: location.id,
        photographerUserId,
        sessionType,
        photographer,
        date: days(offset),
        folderPath: `safe-test-folder/StudioFlow_Test/${slug}/2026/${folderName}`,
        status: "New",
        notes: "Demo session imported from StudioFlow seed data."
      }
    });
    sessions.push(session);
    await prisma.sessionImageReference.createMany({
      data: [1, 2, 3, 4].map((number) => ({
        sessionId: session.id,
        imageRef: `${folderName.toUpperCase()}_${String(number).padStart(3, "0")}.CR3`,
        localPath: `${session.folderPath}/00_ORIGINALS/${folderName}_${number}.CR3`,
        rating: number <= 2 ? 5 : 3,
        selected: number <= 3
      }))
    });
  }

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
    const seededOrderNumber = slug === "fotograf-guld" ? orderNumber : orderNumber.replace("FG", "DPS");
    orders.push(
      await prisma.order.create({
        data: {
          studioId: studio.id,
          sessionId: session.id,
          customerId: session.customerId,
          statusId: statusMap.get(status)?.id,
          orderNumber: seededOrderNumber,
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
        status: order.status === "Cancelled" ? "Cancelled" : "New"
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

  await prisma.productionTask.createMany({
    data: [
      { studioId: studio.id, orderId: orders[0].id, assignedUserId: users.sanne.id, type: "Retouch handoff review", status: "Open", deadline: days(2), notes: "Confirm all retouch notes before sending." },
      { studioId: studio.id, orderId: orders[1].id, assignedUserId: users.martin.id, type: "Delivery preparation", status: "Open", deadline: days(5), notes: "Prepare customer pickup message." }
    ]
  });

  const bridgeAgent = await prisma.bridgeAgent.create({
    data: {
      studioId: studio.id,
      locationId: location.id,
      name: `${name} Bridge Computer`,
      deviceId: `${slug}-bridge-001`,
      status: "Online",
      lastSeenAt: new Date()
    }
  });

  const bridgeJob = await prisma.bridgeJob.create({
    data: {
      studioId: studio.id,
      bridgeAgentId: bridgeAgent.id,
      orderId: orders[0].id,
      requestedByUserId: slug === "fotograf-guld" ? users.daniel.id : users.emma.id,
      type: "Create folder plan",
      dryRun: true,
      status: "Preview"
    }
  });

  await prisma.bridgeLog.createMany({
    data: [
      { studioId: studio.id, bridgeJobId: bridgeJob.id, action: "Dry-run folder plan", status: "Preview", message: `Previewed folder plan for ${orders[0].orderNumber}` },
      { studioId: studio.id, action: "Bridge heartbeat", status: "Online", message: `${bridgeAgent.name} checked in successfully.` }
    ]
  });

  await prisma.generatedFile.createMany({
    data: [
      { studioId: studio.id, orderId: orders[0].id, bridgeJobId: bridgeJob.id, fileType: "order-summary", path: `safe-test-folder/StudioFlow_Test/${slug}/${orders[0].orderNumber}/order-summary.txt`, checksum: "demo-checksum-order" },
      { studioId: studio.id, orderId: orders[0].id, bridgeJobId: bridgeJob.id, fileType: "retouch-list", path: `safe-test-folder/StudioFlow_Test/${slug}/${orders[0].orderNumber}/retouch-list.txt`, checksum: "demo-checksum-retouch" },
      { studioId: studio.id, orderId: orders[0].id, bridgeJobId: bridgeJob.id, fileType: "print-list", path: `safe-test-folder/StudioFlow_Test/${slug}/${orders[0].orderNumber}/print-list.txt`, checksum: "demo-checksum-print" }
    ]
  });

  await prisma.emailLog.createMany({
    data: [
      {
        studioId: studio.id,
        orderId: orders[0].id,
        templateId: emailTemplates[0].id,
        toEmail: retouchers[0].email,
        subject: `Retouch task ${orders[0].orderNumber}`,
        body: "Prepared retouch handoff email for demo data.",
        status: "Prepared"
      },
      {
        studioId: studio.id,
        orderId: orders[1].id,
        templateId: emailTemplates[2].id,
        toEmail: customers[0].email,
        subject: `Your photos are ready - ${orders[1].orderNumber}`,
        body: "Prepared customer pickup email for demo data.",
        status: "Prepared"
      }
    ]
  });

  const subscription = await prisma.studioSubscription.findUniqueOrThrow({ where: { studioId: studio.id } });
  await prisma.paymentCustomer.create({
    data: {
      studioId: studio.id,
      provider: "local-test",
      providerCustomerId: `local_customer_${slug}`
    }
  });
  await prisma.invoice.create({
    data: {
      studioId: studio.id,
      subscriptionId: subscription.id,
      providerInvoiceId: `demo_invoice_${slug}_001`,
      amount: plan.priceDkk * 100,
      currency: "DKK",
      status: plan.priceDkk === 0 ? "Trial" : "Paid",
      issuedAt: days(-2),
      paidAt: plan.priceDkk === 0 ? null : days(-1)
    }
  });
  await prisma.paymentEvent.create({
    data: {
      studioId: studio.id,
      provider: "local-test",
      eventType: "subscription.created",
      externalId: `evt_${slug}_subscription_created`,
      payloadJson: JSON.stringify({ plan: plan.name, localOnly: true, cardDataStored: false, futureProviderTargets: ["Stripe", "Paddle"] }),
      processedAt: new Date()
    }
  });

  const auditUserId = slug === "fotograf-guld" ? users.daniel.id : users.emma.id;
  await prisma.auditLog.createMany({
    data: [
      { studioId: studio.id, userId: auditUserId, action: "studio.seeded", entityType: "Studio", entityId: studio.id, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "customer.created", entityType: "Customer", entityId: customers[0].id, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "customer.edited", entityType: "Customer", entityId: customers[0].id, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "session.created", entityType: "PhotoSession", entityId: sessions[0].id, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "session.edited", entityType: "PhotoSession", entityId: sessions[0].id, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "order.created", entityType: "Order", entityId: orders[0].id, metadataJson: JSON.stringify({ orderNumber: orders[0].orderNumber }) },
      { studioId: studio.id, userId: auditUserId, action: "order.edited", entityType: "Order", entityId: orders[0].id, metadataJson: JSON.stringify({ orderNumber: orders[0].orderNumber }) },
      { studioId: studio.id, userId: auditUserId, action: "order.status_changed", entityType: "Order", entityId: orders[0].id, metadataJson: JSON.stringify({ status: orders[0].status }) },
      { studioId: studio.id, userId: auditUserId, action: "order_item.created", entityType: "Order", entityId: orders[0].id, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "order_item.edited", entityType: "Order", entityId: orders[0].id, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "order_item.cancelled", entityType: "Order", entityId: orders[0].id, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "retouch_task.changed", entityType: "RetouchTask", entityId: null, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "email.prepared", entityType: "EmailLog", entityId: null, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "bridge_job.created", entityType: "BridgeJob", entityId: bridgeJob.id, metadataJson: JSON.stringify({ dryRun: true }) },
      { studioId: studio.id, userId: auditUserId, action: "bridge.previewed", entityType: "BridgeJob", entityId: bridgeJob.id, metadataJson: JSON.stringify({ dryRun: true }) },
      { studioId: studio.id, userId: auditUserId, action: "settings.changed", entityType: "StudioSettings", entityId: null, metadataJson: JSON.stringify({ source: "prisma seed" }) },
      { studioId: studio.id, userId: auditUserId, action: "subscription.changed", entityType: "StudioSubscription", entityId: subscription.id, metadataJson: JSON.stringify({ plan: plan.name }) }
    ]
  });

  await prisma.dataExport.create({
    data: {
      studioId: studio.id,
      requestedByUserId: auditUserId,
      status: "Queued",
      filePath: null
    }
  });

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
  const [planMap, permissionMap, users] = await Promise.all([seedPlans(), seedPermissions(), seedUsers()]);

  await seedStudio({
    name: "Fotograf Guld",
    slug: "fotograf-guld",
    planName: "Studio",
    captureTool: "Lightroom",
    users,
    permissionMap,
    planMap
  });

  await seedStudio({
    name: "Demo Portrait Studio",
    slug: "demo-portrait-studio",
    planName: "Free Trial",
    captureTool: "Capture One",
    users,
    permissionMap,
    planMap
  });

  console.log("StudioFlow production-ready seed data created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
