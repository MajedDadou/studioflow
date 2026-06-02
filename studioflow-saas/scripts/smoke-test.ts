import path from "node:path";
import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { generateTemplateBody, generateTemplateSubject, recommendedEmailRecipient } from "../lib/email";
import { buildFolderPlan } from "../lib/folderPlan";
import { FUTURE_PAYMENT_PROVIDERS, getPlanUsage } from "../lib/billing";

async function countOrFail(label: string, count: number, minimum: number) {
  if (count < minimum) {
    throw new Error(`${label} expected at least ${minimum}, found ${count}`);
  }
  console.log(`${label}: ${count}`);
}

function jsonListOrFail(label: string, value: string | null | undefined, minimum: number) {
  const parsed = value ? JSON.parse(value) : [];
  if (!Array.isArray(parsed) || parsed.length < minimum) {
    throw new Error(`${label} expected at least ${minimum} configured value(s)`);
  }
  return parsed.map(String);
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
    plans,
    users,
    memberships,
    roles,
    permissions,
    locations,
    orderStatuses,
    sessionImageReferences,
    productionTasks,
    emailLogs,
    bridgeAgents,
    bridgeJobs,
    bridgeLogs,
    generatedFiles,
    paymentCustomers,
    invoices,
    paymentEvents,
    auditLogs,
    dataExports
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
    prisma.subscriptionPlan.count(),
    prisma.user.count(),
    prisma.studioMember.count(),
    prisma.role.count(),
    prisma.permission.count(),
    prisma.studioLocation.count(),
    prisma.orderStatus.count(),
    prisma.sessionImageReference.count(),
    prisma.productionTask.count(),
    prisma.emailLog.count(),
    prisma.bridgeAgent.count(),
    prisma.bridgeJob.count(),
    prisma.bridgeLog.count(),
    prisma.generatedFile.count(),
    prisma.paymentCustomer.count(),
    prisma.invoice.count(),
    prisma.paymentEvent.count(),
    prisma.auditLog.count(),
    prisma.dataExport.count()
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
  await countOrFail("Users", users, 5);
  await countOrFail("Studio memberships", memberships, 6);
  await countOrFail("Roles", roles, 8);
  await countOrFail("Permissions", permissions, 8);
  await countOrFail("Studio locations", locations, 2);
  await countOrFail("Order statuses", orderStatuses, 18);
  await countOrFail("Session image references", sessionImageReferences, 20);
  await countOrFail("Production tasks", productionTasks, 4);
  await countOrFail("Email logs", emailLogs, 4);
  await countOrFail("Bridge agents", bridgeAgents, 2);
  await countOrFail("Bridge jobs", bridgeJobs, 2);
  await countOrFail("Bridge logs", bridgeLogs, 4);
  await countOrFail("Generated files", generatedFiles, 4);
  await countOrFail("Payment customers", paymentCustomers, 2);
  await countOrFail("Invoices", invoices, 2);
  await countOrFail("Payment events", paymentEvents, 2);
  await countOrFail("Audit logs", auditLogs, 6);
  await countOrFail("Data exports", dataExports, 2);

  const auditSource = `${await readFile(path.join(process.cwd(), "app", "actions.ts"), "utf8")}\n${await readFile(
    path.join(process.cwd(), "prisma", "seed.ts"),
    "utf8"
  )}`;
  const requiredAuditActions = [
    "customer.created",
    "customer.edited",
    "session.created",
    "session.edited",
    "order.created",
    "order.edited",
    "order.status_changed",
    "order_item.created",
    "order_item.edited",
    "order_item.cancelled",
    "retouch_task.changed",
    "email.prepared",
    "bridge_job.created",
    "settings.changed",
    "subscription.changed"
  ];
  for (const action of requiredAuditActions) {
    if (!auditSource.includes(`"${action}"`)) {
      throw new Error(`Audit coverage failed: missing ${action}`);
    }
  }
  console.log(`Audit coverage: ${requiredAuditActions.length} required operational actions are wired.`);

  const seededPlans = await prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });
  const expectedPlanNames = ["Free Trial", "Starter", "Studio", "Pro"];
  for (const planName of expectedPlanNames) {
    if (!seededPlans.some((plan) => plan.name === planName)) {
      throw new Error(`Billing setup failed: missing ${planName} plan`);
    }
  }
  const freeTrialPlan = seededPlans.find((plan) => plan.name === "Free Trial");
  const studioPlan = seededPlans.find((plan) => plan.name === "Studio");
  if (!freeTrialPlan || freeTrialPlan.orderLimit !== 20 || freeTrialPlan.bridgeAutomation) {
    throw new Error("Billing setup failed: Free Trial limits are not configured correctly");
  }
  if (!studioPlan || !studioPlan.bridgeAutomation || studioPlan.userLimit < 2) {
    throw new Error("Billing setup failed: Studio plan should include bridge automation and multiple users");
  }
  if (FUTURE_PAYMENT_PROVIDERS.length < 2) {
    throw new Error("Billing setup failed: future payment provider targets are not documented in code");
  }

  const orderWithItems = await prisma.order.findFirst({
    where: { items: { some: {} } },
    include: { customer: true, session: true, items: { include: { product: true, frame: true } } }
  });
  if (!orderWithItems) {
    throw new Error("No order with selected image items found");
  }

  console.log(
    `Workflow sample: ${orderWithItems.orderNumber} for ${orderWithItems.customer.name} has ${orderWithItems.items.length} selected image items.`
  );
  const activeItemTotal = orderWithItems.items
    .filter((item) => item.status !== "Cancelled" && item.status !== "Inactive")
    .reduce((sum, item) => sum + (item.product.price + (item.frame?.price ?? 0)) * item.quantity, 0);
  if (orderWithItems.totalPrice !== activeItemTotal) {
    throw new Error(
      `Order total mismatch for ${orderWithItems.orderNumber}: expected ${activeItemTotal}, found ${orderWithItems.totalPrice}`
    );
  }
  if (!orderWithItems.paymentStatus || typeof orderWithItems.internalNotes !== "string" || typeof orderWithItems.customerNotes !== "string") {
    throw new Error("Order workflow failed: payment status or order notes are missing from seeded orders");
  }
  const itemWithRetouchInstructions = orderWithItems.items.find((item) => item.retouchType !== "None" && item.retouchNotes);
  if (!itemWithRetouchInstructions) {
    throw new Error("Order workflow failed: no selected image item has per-image retouch instructions");
  }
  console.log(`Order validation sample: total and retouch notes are valid for ${orderWithItems.orderNumber}.`);

  const retouchWorkflowTask = await prisma.retouchTask.findFirst({
    where: { urgent: true, assignedRetoucherId: { not: null } },
    include: {
      assignedRetoucher: true,
      orderItem: {
        include: {
          order: { include: { customer: true } }
        }
      }
    }
  });
  if (!retouchWorkflowTask) {
    throw new Error("Retouch workflow failed: no urgent task with an assigned retoucher found");
  }
  if (!retouchWorkflowTask.orderItem.imageRef || !retouchWorkflowTask.orderItem.order.orderNumber || !retouchWorkflowTask.deadline) {
    throw new Error("Retouch workflow failed: task is missing image, order, or deadline context");
  }
  if (!["Not started", "Sent to retoucher", "In progress", "Needs changes", "Done", "Approved", "Cancelled"].includes(retouchWorkflowTask.status)) {
    throw new Error(`Retouch workflow failed: unsupported task status ${retouchWorkflowTask.status}`);
  }
  const missingRetouchTaskCount = await prisma.orderItem.count({
    where: {
      order: { studioId: retouchWorkflowTask.studioId },
      status: { notIn: ["Cancelled", "Inactive"] },
      OR: [{ retouchType: { not: "None" } }, { retouchNotes: { not: null } }, { urgent: true }],
      retouchTask: null
    }
  });
  if (missingRetouchTaskCount !== 0) {
    throw new Error(`Retouch workflow failed: ${missingRetouchTaskCount} retouch item(s) have no generated task`);
  }
  console.log(
    `Retouch workflow sample: ${retouchWorkflowTask.orderItem.imageRef} for ${retouchWorkflowTask.orderItem.order.customer.name} is assigned to ${retouchWorkflowTask.assignedRetoucher?.name}.`
  );

  const retouchTemplate = await prisma.emailTemplate.findFirst({
    where: { studioId: orderWithItems.studioId, name: "Retouch task email" }
  });
  const emailOrder = await prisma.order.findFirst({
    where: { id: orderWithItems.id },
    include: {
      customer: true,
      session: true,
      items: {
        include: {
          product: true,
          frame: true,
          retouchTask: { include: { assignedRetoucher: true } }
        }
      }
    }
  });
  if (!retouchTemplate || !emailOrder) {
    throw new Error("Email workflow failed: missing retouch template or email order");
  }
  const emailRetouchItem = emailOrder.items.find((item) => item.retouchType !== "None" && item.retouchNotes);
  if (!emailRetouchItem) {
    throw new Error("Email workflow failed: selected order has no retouch item for email generation");
  }
  const generatedSubject = generateTemplateSubject(retouchTemplate.subject, emailOrder);
  const generatedBody = generateTemplateBody(retouchTemplate.body, emailOrder);
  const generatedRecipient = recommendedEmailRecipient(retouchTemplate.type, emailOrder);
  const requiredEmailParts = [
    emailOrder.orderNumber,
    emailOrder.customer.name,
    emailOrder.session.sessionType,
    emailOrder.session.folderPath,
    emailOrder.internalNotes ?? "",
    emailRetouchItem.imageRef,
    emailRetouchItem.retouchNotes ?? "",
    emailRetouchItem.retouchTask?.assignedRetoucher?.name ?? ""
  ].filter(Boolean);
  for (const part of requiredEmailParts) {
    if (!generatedBody.includes(part) && !generatedSubject.includes(part)) {
      throw new Error(`Email workflow failed: generated email is missing "${part}"`);
    }
  }
  if (!generatedRecipient) {
    throw new Error("Email workflow failed: retouch email did not suggest a retoucher recipient");
  }
  const preparedLog = await prisma.emailLog.findFirst({
    where: { studioId: emailOrder.studioId, status: "Prepared", orderId: { not: null }, templateId: { not: null } },
    include: { order: true, template: true }
  });
  if (!preparedLog || !preparedLog.subject || !preparedLog.body) {
    throw new Error("Email workflow failed: no prepared email log with subject and body found");
  }
  console.log(`Email workflow sample: generated ${retouchTemplate.name} preview for ${emailOrder.orderNumber}.`);

  const bridgePlan = buildFolderPlan(emailOrder);
  const expectedSafeRoot = path.resolve(process.cwd(), "safe-test-folder", "StudioFlow_Test");
  if (path.resolve(bridgePlan.safeRoot) !== expectedSafeRoot) {
    throw new Error(`Bridge workflow failed: expected safe root ${expectedSafeRoot}, found ${bridgePlan.safeRoot}`);
  }
  const unsafePlannedTarget = bridgePlan.targetPaths.find((target) => {
    const relative = path.relative(bridgePlan.safeRoot, target);
    return relative.startsWith("..") || path.isAbsolute(relative);
  });
  if (unsafePlannedTarget) {
    throw new Error(`Bridge workflow failed: planned target escapes safe folder: ${unsafePlannedTarget}`);
  }
  for (const fileType of ["order-summary", "retouch-list", "print-list"]) {
    if (!bridgePlan.files.some((file) => file.fileType === fileType)) {
      throw new Error(`Bridge workflow failed: folder plan is missing ${fileType}`);
    }
  }
  const bridgeJobWithLog = await prisma.bridgeJob.findFirst({
    include: { logs: true, generatedFiles: true }
  });
  if (!bridgeJobWithLog || bridgeJobWithLog.logs.length === 0) {
    throw new Error("Bridge workflow failed: no bridge job with logs found");
  }
  const generatedFileRecords = await prisma.generatedFile.findMany();
  const unsafeGeneratedRecord = generatedFileRecords.find(
    (file) => !file.path.replaceAll("\\", "/").includes("safe-test-folder/StudioFlow_Test")
  );
  if (unsafeGeneratedRecord) {
    throw new Error(`Bridge workflow failed: generated file record is outside the safe test folder: ${unsafeGeneratedRecord.path}`);
  }
  console.log(
    `Bridge workflow sample: ${bridgePlan.folders.length} folder target(s), ${bridgePlan.files.length} generated file target(s), and safe file records are available.`
  );

  const sessionWithReferences = await prisma.photoSession.findFirst({
    where: { imageReferences: { some: {} } },
    include: { customer: true, imageReferences: true, orders: true }
  });
  if (!sessionWithReferences) {
    throw new Error("No session with selected image references found");
  }
  if (!sessionWithReferences.folderPath.trim()) {
    throw new Error("Session workflow failed: selected-reference session is missing a folder path");
  }
  console.log(
    `Session workflow sample: ${sessionWithReferences.customer.name} has ${sessionWithReferences.imageReferences.length} selected image reference(s) and ${sessionWithReferences.orders.length} order(s).`
  );

  const devLoginUser = await prisma.user.findFirst({
    where: { email: "sanne@studioflow.test" },
    include: {
      memberships: {
        where: { active: true },
        include: { studio: true, role: true }
      }
    }
  });
  if (!devLoginUser || devLoginUser.memberships.length === 0) {
    throw new Error("Seeded development login user has no active memberships");
  }
  console.log(
    `Development login sample: ${devLoginUser.name} can access ${devLoginUser.memberships.length} studio(s).`
  );

  const founderAdminUser = await prisma.user.findUnique({
    where: { email: "daniel@studioflow.test" },
    include: { memberships: { include: { studio: true, role: true } } }
  });
  if (!founderAdminUser || founderAdminUser.memberships.length === 0) {
    throw new Error("Owner admin failed: Daniel founder-admin seed user is missing or has no memberships");
  }
  const ownerAdminStudios = await prisma.studio.findMany({
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { customers: true, members: true, orders: true } }
    }
  });
  if (ownerAdminStudios.length < 2 || ownerAdminStudios.some((studio) => !studio.subscription?.plan)) {
    throw new Error("Owner admin failed: all studios overview cannot show subscription and count data");
  }
  const ownerAdminEmailIssues = await prisma.emailLog.count({ where: { status: { in: ["Failed", "Prepared"] } } });
  const ownerAdminBridgeIssues = await prisma.bridgeJob.count({ where: { status: { in: ["Failed", "Blocked"] } } });
  console.log(
    `Owner admin sample: ${ownerAdminStudios.length} studios, ${ownerAdminEmailIssues} prepared/failed email(s), ${ownerAdminBridgeIssues} blocked/failed bridge job(s).`
  );

  const [fotografGuld, demoStudio] = await Promise.all([
    prisma.studio.findUnique({ where: { slug: "fotograf-guld" } }),
    prisma.studio.findUnique({ where: { slug: "demo-portrait-studio" } })
  ]);
  if (!fotografGuld || !demoStudio) {
    throw new Error("Expected both seeded demo studios for tenant isolation checks");
  }

  const fotografGuldBilling = await prisma.studio.findUnique({
    where: { id: fotografGuld.id },
    include: {
      subscription: { include: { plan: true } },
      paymentCustomer: true,
      invoices: true,
      paymentEvents: true
    }
  });
  if (!fotografGuldBilling?.subscription?.plan) {
    throw new Error("Billing workflow failed: Fotograf Guld has no current subscription plan");
  }
  if (!["Active", "Trialing"].includes(fotografGuldBilling.subscription.status)) {
    throw new Error(`Billing workflow failed: unsupported subscription status ${fotografGuldBilling.subscription.status}`);
  }
  if (!fotografGuldBilling.paymentCustomer) {
    throw new Error("Billing workflow failed: missing payment customer record");
  }
  if (/(card|cvc|pan|4242)/i.test(fotografGuldBilling.paymentCustomer.providerCustomerId)) {
    throw new Error("Billing workflow failed: payment customer appears to contain card data");
  }
  if (fotografGuldBilling.invoices.length === 0 || fotografGuldBilling.paymentEvents.length === 0) {
    throw new Error("Billing workflow failed: missing invoice or payment event records");
  }
  const billingUsage = await getPlanUsage(fotografGuld.id);
  if (!billingUsage.plan || billingUsage.orderCount < 1 || billingUsage.activeUsers < 1) {
    throw new Error("Billing workflow failed: plan usage could not be calculated");
  }
  console.log(
    `Billing sample: ${fotografGuldBilling.name} is on ${fotografGuldBilling.subscription.plan.name} with ${billingUsage.orderCount} order(s) and ${billingUsage.activeUsers} active user(s).`
  );

  const [reportOrdersThisMonth, reportPendingRetouch, reportUrgentOrders, reportRepeatCustomers, reportCommonItems] = await Promise.all([
    prisma.order.count({
      where: { studioId: fotografGuld.id, orderDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }
    }),
    prisma.retouchTask.count({ where: { studioId: fotografGuld.id, status: { notIn: ["Done", "Approved", "Cancelled"] } } }),
    prisma.order.count({
      where: {
        studioId: fotografGuld.id,
        status: { notIn: ["Delivered", "Cancelled"] },
        items: { some: { urgent: true, status: { notIn: ["Cancelled", "Inactive"] } } }
      }
    }),
    prisma.customer.findMany({
      where: { studioId: fotografGuld.id },
      include: { _count: { select: { sessions: true, orders: true } } }
    }),
    prisma.orderItem.findMany({
      where: { order: { studioId: fotografGuld.id }, status: { notIn: ["Cancelled", "Inactive"] } },
      include: { product: true }
    })
  ]);
  if (reportOrdersThisMonth < 1 || reportPendingRetouch < 1 || reportCommonItems.length < 1) {
    throw new Error("Reports failed: expected monthly orders, pending retouch, and product usage for Fotograf Guld");
  }
  if (!reportRepeatCustomers.some((customer) => customer._count.sessions > 1 || customer._count.orders > 1)) {
    throw new Error("Reports failed: no repeat customer history is available");
  }
  console.log(
    `Reports sample: ${reportOrdersThisMonth} monthly order(s), ${reportPendingRetouch} pending retouch task(s), ${reportUrgentOrders} urgent order(s).`
  );

  const [fotografGuldSettings, fotografGuldProduct, fotografGuldFrame] = await Promise.all([
    prisma.studioSettings.findUnique({ where: { studioId: fotografGuld.id } }),
    prisma.product.findFirst({ where: { studioId: fotografGuld.id, sizeOptionsJson: { not: null } } }),
    prisma.frame.findFirst({ where: { studioId: fotografGuld.id } })
  ]);
  if (!fotografGuldSettings) {
    throw new Error("Fotograf Guld is missing studio settings");
  }
  if (!fotografGuld.country || !fotografGuld.timezone) {
    throw new Error("Studio configuration failed: country or timezone is missing");
  }
  jsonListOrFail("Workflow statuses", fotografGuldSettings.workflowStatusesJson, 3);
  jsonListOrFail("Session types", fotografGuldSettings.sessionTypesJson, 3);
  jsonListOrFail("Retouch types", fotografGuldSettings.retouchTypesJson, 2);
  jsonListOrFail("Photographers", fotografGuldSettings.photographersJson, 1);
  if (!["Lightroom", "Capture One", "Manual folders"].includes(fotografGuldSettings.captureTool)) {
    throw new Error(`Unsupported capture tool in settings: ${fotografGuldSettings.captureTool}`);
  }
  if (!fotografGuldProduct || jsonListOrFail("Product size options", fotografGuldProduct.sizeOptionsJson, 1).length === 0) {
    throw new Error("Product configuration failed: missing product with default size options");
  }
  if (!fotografGuldFrame) {
    throw new Error("Frame configuration failed: missing frame for Fotograf Guld");
  }

  const [crossTenantProduct, crossTenantFrame] = await Promise.all([
    prisma.product.findFirst({ where: { id: fotografGuldProduct.id, studioId: demoStudio.id } }),
    prisma.frame.findFirst({ where: { id: fotografGuldFrame.id, studioId: demoStudio.id } })
  ]);
  if (crossTenantProduct) {
    throw new Error("Tenant isolation failed: a Fotograf Guld product resolved under Demo Portrait Studio");
  }
  if (crossTenantFrame) {
    throw new Error("Tenant isolation failed: a Fotograf Guld frame resolved under Demo Portrait Studio");
  }
  console.log("Configuration sample: settings, products, and frames are scoped per studio.");

  const fotografGuldTask = await prisma.retouchTask.findFirst({ where: { studioId: fotografGuld.id } });
  if (fotografGuldTask) {
    const crossTenantTask = await prisma.retouchTask.findFirst({
      where: { id: fotografGuldTask.id, studioId: demoStudio.id }
    });
    if (crossTenantTask) {
      throw new Error("Tenant isolation failed: a Fotograf Guld retouch task resolved under Demo Portrait Studio");
    }
  }

  const [fotografGuldBridgeJob, fotografGuldGeneratedFile] = await Promise.all([
    prisma.bridgeJob.findFirst({ where: { studioId: fotografGuld.id } }),
    prisma.generatedFile.findFirst({ where: { studioId: fotografGuld.id } })
  ]);
  if (fotografGuldBridgeJob) {
    const crossTenantBridgeJob = await prisma.bridgeJob.findFirst({
      where: { id: fotografGuldBridgeJob.id, studioId: demoStudio.id }
    });
    if (crossTenantBridgeJob) {
      throw new Error("Tenant isolation failed: a Fotograf Guld bridge job resolved under Demo Portrait Studio");
    }
  }
  if (fotografGuldGeneratedFile) {
    const crossTenantGeneratedFile = await prisma.generatedFile.findFirst({
      where: { id: fotografGuldGeneratedFile.id, studioId: demoStudio.id }
    });
    if (crossTenantGeneratedFile) {
      throw new Error("Tenant isolation failed: a Fotograf Guld generated file resolved under Demo Portrait Studio");
    }
  }

  const fotografGuldOrder = await prisma.order.findFirst({
    where: { studioId: fotografGuld.id },
    include: { customer: true, session: true }
  });
  const demoCustomer = await prisma.customer.findFirst({ where: { studioId: demoStudio.id } });
  if (!fotografGuldOrder || !demoCustomer) {
    throw new Error("Missing seeded records for tenant isolation checks");
  }

  const crossTenantOrder = await prisma.order.findFirst({
    where: { id: fotografGuldOrder.id, studioId: demoStudio.id }
  });
  if (crossTenantOrder) {
    throw new Error("Tenant isolation failed: a Fotograf Guld order resolved under Demo Portrait Studio");
  }

  const crossTenantCustomer = await prisma.customer.findFirst({
    where: { id: demoCustomer.id, studioId: fotografGuld.id }
  });
  if (crossTenantCustomer) {
    throw new Error("Tenant isolation failed: a Demo Portrait Studio customer resolved under Fotograf Guld");
  }

  const daniel = await prisma.user.findUnique({
    where: { email: "daniel@studioflow.test" },
    include: { memberships: true }
  });
  if (!daniel || daniel.memberships.some((membership) => membership.studioId === demoStudio.id)) {
    throw new Error("Tenant isolation failed: Daniel should not have Demo Portrait Studio membership");
  }
  console.log("Tenant isolation checks: URL-id lookups must include the active studio id.");

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
