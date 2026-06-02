"use server";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { safeJsonList } from "@/lib/format";
import { STUDIO_COOKIE, USER_COOKIE, createAuditLog, getActiveStudio, getActiveStudioContext } from "@/lib/studio";
import { generateOrderNumber } from "@/lib/orderNumber";
import { buildFolderPlan } from "@/lib/folderPlan";
import { orderItemStatusForRetouchStatus, retouchStatuses } from "@/lib/retouch";
import {
  emailTemplateTypes,
  generateTemplateBody,
  generateTemplateSubject,
  recommendedEmailRecipient
} from "@/lib/email";
import {
  LOCAL_BILLING_PROVIDER,
  assertCanCreateOrder,
  assertBridgeAutomationAvailable,
  getPlanUsage,
  nextMonthlyRenewal,
  subscriptionStatusForPlan,
  trialEndsAt
} from "@/lib/billing";

const sessionStatuses = ["New", "In selection", "Ready for order", "Order created", "Completed", "Cancelled"];
const paymentStatuses = ["Not paid", "Partly paid", "Paid", "Refunded"];
const orderItemStatuses = ["New", "In production", "Ready", "Delivered", "Cancelled", "Inactive"];
const inactiveOrderItemStatuses = ["Cancelled", "Inactive"];
const defaultOrderStatuses = [
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
const captureTools = ["Lightroom", "Capture One", "Manual folders"];

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optional(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function emailValue(formData: FormData, key: string) {
  const email = optional(formData, key);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email must be a valid email address");
  }
  return email;
}

function dateValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Date must be a valid date");
  }
  return date;
}

function quantityValue(formData: FormData) {
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!Number.isFinite(quantity) || quantity < 1) {
    throw new Error("Quantity must be at least 1");
  }
  return Math.floor(quantity);
}

function priceValue(formData: FormData) {
  const raw = required(formData, "price").replace(",", ".");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Price must be a valid amount and cannot be negative");
  }
  return Math.round(parsed * 100);
}

function approvedBridgeSafeRoot() {
  return path.resolve(process.cwd(), "safe-test-folder", "StudioFlow_Test");
}

function isInsideSafeRoot(target: string, safeRoot: string) {
  const resolvedRoot = path.resolve(safeRoot);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function pathExists(target: string) {
  try {
    await fs.stat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function contentChecksum(content: string) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function imageReferenceList(value: FormDataEntryValue | null) {
  const seen = new Set<string>();
  return String(value ?? "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function productNeedsSize(product: { name: string; type: string }) {
  const label = `${product.name} ${product.type}`.toLowerCase();
  return ["print", "frame", "framed", "canvas", "album"].some((token) => label.includes(token));
}

function enumValue(value: string, allowed: string[], fieldName: string) {
  if (!allowed.includes(value)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function sizeValue(formData: FormData, product: { name: string; type: string }) {
  const size = optional(formData, "size") ?? "-";
  if (productNeedsSize(product) && size === "-") {
    throw new Error("Size is required for print, frame, canvas, and album products");
  }
  return size;
}

function validateFrameForSize(frame: { size: string } | null, size: string) {
  if (!frame) return;
  if (size === "-") {
    throw new Error("Size is required when a frame is selected");
  }
  if (frame.size && frame.size !== size) {
    throw new Error(`Frame size ${frame.size} does not match selected size ${size}`);
  }
}

function jsonListFromRequiredTextarea(value: FormDataEntryValue | null, fieldName: string) {
  const items = String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) {
    throw new Error(`${fieldName} must contain at least one value`);
  }
  return JSON.stringify(items);
}

function timezoneValue(formData: FormData) {
  const timezone = required(formData, "timezone");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error("Timezone must be a valid IANA timezone, for example Europe/Copenhagen");
  }
  return timezone;
}

function returnToPath(formData: FormData, fallback: string) {
  const target = optional(formData, "returnTo") ?? fallback;
  return target.startsWith("/") && !target.startsWith("//") ? target : fallback;
}

function redirectWithMessage(pathname: string, key: string, message: string) {
  const [pathOnly, rawQuery = ""] = pathname.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set(key, message);
  redirect(`${pathOnly}?${params.toString()}`);
}

async function logActivity(studioId: string, message: string) {
  await prisma.activity.create({ data: { studioId, message } });
}

async function replaceSessionImageReferences(sessionId: string, imageRefs: string[]) {
  await prisma.sessionImageReference.deleteMany({ where: { sessionId } });
  if (imageRefs.length === 0) return;

  await prisma.sessionImageReference.createMany({
    data: imageRefs.map((imageRef) => ({
      sessionId,
      imageRef,
      selected: true
    }))
  });
}

async function recalculateOrderTotal(orderId: string, studioId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId, status: { notIn: inactiveOrderItemStatuses }, order: { studioId } },
    include: { product: true, frame: true }
  });
  const total = items.reduce((sum, item) => {
    const line = (item.product.price + (item.frame?.price ?? 0)) * item.quantity;
    return sum + line;
  }, 0);
  await prisma.order.update({ where: { id: orderId, studioId }, data: { totalPrice: total } });
}

async function syncRetouchTask({
  studioId,
  orderItemId,
  assignedRetoucherId,
  retouchType,
  retouchNotes,
  deadline,
  urgent
}: {
  studioId: string;
  orderItemId: string;
  assignedRetoucherId: string | null;
  retouchType: string;
  retouchNotes: string | null;
  deadline: Date | null;
  urgent: boolean;
}) {
  const task = await prisma.retouchTask.findUnique({ where: { orderItemId } });
  const needsRetouchTask = retouchType !== "None" || Boolean(retouchNotes) || urgent;

  if (!needsRetouchTask) {
    if (task) {
      await prisma.retouchTask.update({
        where: { id: task.id, studioId },
        data: {
          assignedRetoucherId: null,
          retouchType,
          notes: null,
          deadline,
          urgent: false,
          status: "Cancelled"
        }
      });
    }
    return;
  }

  if (task) {
    await prisma.retouchTask.update({
      where: { id: task.id, studioId },
      data: {
        assignedRetoucherId,
        retouchType,
        notes: retouchNotes,
        deadline,
        urgent,
        status: task.status === "Cancelled" ? "Not started" : task.status
      }
    });
    return;
  }

  await prisma.retouchTask.create({
    data: {
      studioId,
      orderItemId,
      assignedRetoucherId,
      retouchType,
      notes: retouchNotes,
      deadline,
      urgent,
      status: "Not started"
    }
  });
}

export async function loginDevUser(formData: FormData) {
  const userId = required(formData, "userId");
  const studioId = required(formData, "studioId");
  const membership = await prisma.studioMember.findFirst({
    where: { userId, studioId, active: true },
    include: { user: true, studio: true, role: true }
  });
  if (!membership) {
    throw new Error("Selected user is not a member of the selected studio");
  }

  const cookieStore = await cookies();
  cookieStore.set(USER_COOKIE, userId, { path: "/", sameSite: "lax", httpOnly: true });
  cookieStore.set(STUDIO_COOKIE, studioId, { path: "/", sameSite: "lax", httpOnly: true });
  await createAuditLog({
    studioId,
    userId,
    action: "dev_login",
    entityType: "StudioMember",
    entityId: membership.id,
    metadata: { role: membership.role.name }
  });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logoutDevUser() {
  await createAuditLog({ action: "logout", entityType: "User" });
  const cookieStore = await cookies();
  cookieStore.delete(USER_COOKIE);
  cookieStore.delete(STUDIO_COOKIE);
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function switchStudio(formData: FormData) {
  const context = await getActiveStudioContext();
  const studioId = required(formData, "studioId");
  const membership = context.memberships.find((item) => item.studioId === studioId);
  if (!membership) {
    throw new Error("You are not a member of this studio");
  }
  const cookieStore = await cookies();
  cookieStore.set(STUDIO_COOKIE, studioId, { path: "/", sameSite: "lax", httpOnly: true });
  await createAuditLog({
    studioId,
    userId: context.user.id,
    action: "switch_studio",
    entityType: "Studio",
    entityId: studioId,
    metadata: { fromStudioId: context.studio.id }
  });
  revalidatePath("/", "layout");
}

export async function changeSubscriptionPlan(formData: FormData) {
  const context = await getActiveStudioContext();
  const returnTo = returnToPath(formData, "/billing");
  const planId = required(formData, "planId");
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } });
  const usage = await getPlanUsage(context.studio.id, plan);
  const previousSubscription = await prisma.studioSubscription.findUnique({
    where: { studioId: context.studio.id },
    include: { plan: true }
  });
  const previousPlanName = previousSubscription?.plan.name ?? "No plan";

  if (usage.blockers.length > 0) {
    await prisma.paymentEvent.create({
      data: {
        studioId: context.studio.id,
        provider: LOCAL_BILLING_PROVIDER,
        eventType: "subscription.change_blocked",
        externalId: `local_evt_${crypto.randomUUID()}`,
        payloadJson: JSON.stringify({
          previousPlan: previousPlanName,
          requestedPlan: plan.name,
          blockers: usage.blockers,
          localOnly: true,
          cardDataStored: false
        }),
        processedAt: new Date()
      }
    });
    await createAuditLog({
      studioId: context.studio.id,
      userId: context.user.id,
      action: "billing_plan_change_blocked",
      entityType: "SubscriptionPlan",
      entityId: plan.id,
      metadata: { previousPlan: previousPlanName, requestedPlan: plan.name, blockers: usage.blockers }
    });
    revalidatePath("/billing");
    revalidatePath("/pricing");
    redirectWithMessage(returnTo, "billingMessage", `Plan change blocked: ${usage.blockers.join(" ")}`);
  }

  const now = new Date();
  const status = subscriptionStatusForPlan(plan);
  const subscription = await prisma.studioSubscription.upsert({
    where: { studioId: context.studio.id },
    update: {
      planId: plan.id,
      status,
      startedAt: now,
      trialEndsAt: plan.name === "Free Trial" ? trialEndsAt(now) : null,
      renewsAt: plan.priceDkk > 0 ? nextMonthlyRenewal(now) : null
    },
    create: {
      studioId: context.studio.id,
      planId: plan.id,
      status,
      startedAt: now,
      trialEndsAt: plan.name === "Free Trial" ? trialEndsAt(now) : null,
      renewsAt: plan.priceDkk > 0 ? nextMonthlyRenewal(now) : null
    }
  });

  await prisma.paymentCustomer.upsert({
    where: { studioId: context.studio.id },
    update: {
      provider: LOCAL_BILLING_PROVIDER,
      providerCustomerId: `local_customer_${context.studio.slug}`
    },
    create: {
      studioId: context.studio.id,
      provider: LOCAL_BILLING_PROVIDER,
      providerCustomerId: `local_customer_${context.studio.slug}`
    }
  });

  const invoice = await prisma.invoice.create({
    data: {
      studioId: context.studio.id,
      subscriptionId: subscription.id,
      providerInvoiceId: `local_invoice_${crypto.randomUUID()}`,
      amount: plan.priceDkk * 100,
      currency: "DKK",
      status: plan.priceDkk === 0 ? "Trial" : "Simulated",
      issuedAt: now,
      paidAt: null
    }
  });

  await prisma.paymentEvent.create({
    data: {
      studioId: context.studio.id,
      provider: LOCAL_BILLING_PROVIDER,
      eventType: "subscription.plan_changed",
      externalId: `local_evt_${crypto.randomUUID()}`,
      payloadJson: JSON.stringify({
        previousPlan: previousPlanName,
        nextPlan: plan.name,
        invoiceId: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        localOnly: true,
        cardDataStored: false,
        futureProviderTargets: ["Stripe", "Paddle"]
      }),
      processedAt: now
    }
  });

  await createAuditLog({
    studioId: context.studio.id,
    userId: context.user.id,
    action: "subscription.changed",
    entityType: "StudioSubscription",
    entityId: subscription.id,
    metadata: { previousPlan: previousPlanName, nextPlan: plan.name, invoiceId: invoice.id, provider: LOCAL_BILLING_PROVIDER }
  });

  revalidatePath("/billing");
  revalidatePath("/pricing");
  revalidatePath("/", "layout");
  redirectWithMessage(returnTo, "billingMessage", `Plan changed locally to ${plan.name}. No real payment was processed.`);
}

export async function createCustomer(formData: FormData) {
  const studio = await getActiveStudio();
  const customer = await prisma.customer.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      phone: optional(formData, "phone"),
      email: emailValue(formData, "email"),
      notes: optional(formData, "notes")
    }
  });
  await logActivity(studio.id, `Customer created: ${customer.name}`);
  await createAuditLog({ studioId: studio.id, action: "customer.created", entityType: "Customer", entityId: customer.id });
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const customer = await prisma.customer.update({
    where: { id: customerId, studioId: studio.id },
    data: {
      name: required(formData, "name"),
      phone: optional(formData, "phone"),
      email: emailValue(formData, "email"),
      notes: optional(formData, "notes")
    }
  });
  await logActivity(customer.studioId, `Customer updated: ${customer.name}`);
  await createAuditLog({ studioId: customer.studioId, action: "customer.edited", entityType: "Customer", entityId: customer.id });
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function createSession(formData: FormData) {
  const studio = await getActiveStudio();
  const customerId = required(formData, "customerId");
  await prisma.customer.findFirstOrThrow({ where: { id: customerId, studioId: studio.id } });
  const sessionDate = dateValue(formData.get("date"));
  if (!sessionDate) throw new Error("date is required");
  const imageRefs = imageReferenceList(formData.get("imageRefs"));

  const session = await prisma.photoSession.create({
    data: {
      studioId: studio.id,
      customerId,
      sessionType: required(formData, "sessionType"),
      photographer: required(formData, "photographer"),
      date: sessionDate,
      folderPath: required(formData, "folderPath"),
      notes: optional(formData, "notes"),
      status: enumValue(optional(formData, "status") ?? "New", sessionStatuses, "Session status")
    }
  });
  await replaceSessionImageReferences(session.id, imageRefs);
  await logActivity(studio.id, `Session created: ${session.sessionType}`);
  await createAuditLog({
    studioId: studio.id,
    action: "session.created",
    entityType: "PhotoSession",
    entityId: session.id,
    metadata: { imageReferenceCount: imageRefs.length }
  });
  revalidatePath("/sessions");
  redirect(`/sessions/${session.id}`);
}

export async function updateSession(sessionId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const existingSession = await prisma.photoSession.findFirstOrThrow({
    where: { id: sessionId, studioId: studio.id },
    include: { orders: { where: { studioId: studio.id }, select: { id: true } } }
  });
  const customerId = required(formData, "customerId");
  await prisma.customer.findFirstOrThrow({ where: { id: customerId, studioId: studio.id } });
  const sessionDate = dateValue(formData.get("date"));
  if (!sessionDate) throw new Error("date is required");
  const imageRefs = imageReferenceList(formData.get("imageRefs"));

  const session = await prisma.photoSession.update({
    where: { id: existingSession.id, studioId: studio.id },
    data: {
      customerId,
      sessionType: required(formData, "sessionType"),
      photographer: required(formData, "photographer"),
      date: sessionDate,
      folderPath: required(formData, "folderPath"),
      status: enumValue(required(formData, "status"), sessionStatuses, "Session status"),
      notes: optional(formData, "notes")
    }
  });
  await replaceSessionImageReferences(session.id, imageRefs);
  await logActivity(studio.id, `Session updated: ${session.sessionType}`);
  await createAuditLog({
    studioId: studio.id,
    action: "session.edited",
    entityType: "PhotoSession",
    entityId: session.id,
    metadata: { imageReferenceCount: imageRefs.length, connectedOrderCount: existingSession.orders.length }
  });
  revalidatePath("/sessions");
  revalidatePath(`/sessions/${session.id}`);
  redirect(`/sessions/${session.id}`);
}

export async function createOrder(formData: FormData) {
  const studio = await getActiveStudio();
  await assertCanCreateOrder(studio.id);
  const sessionId = required(formData, "sessionId");
  const session = await prisma.photoSession.findFirstOrThrow({ where: { id: sessionId, studioId: studio.id } });
  const paymentStatus = enumValue(optional(formData, "paymentStatus") ?? "Not paid", paymentStatuses, "Payment status");
  const orderNumber = await generateOrderNumber(
    studio.id,
    studio.name,
    studio.settings?.orderIdFormat ?? "{studioCode}-{year}-{sequence4}"
  );
  const order = await prisma.order.create({
    data: {
      studioId: studio.id,
      sessionId,
      customerId: session.customerId,
      orderNumber,
      deadline: dateValue(formData.get("deadline")),
      status: "New",
      paymentStatus,
      internalNotes: optional(formData, "internalNotes"),
      customerNotes: optional(formData, "customerNotes")
    }
  });
  await prisma.photoSession.update({
    where: { id: session.id, studioId: studio.id },
    data: { status: "Order created" }
  });
  await logActivity(studio.id, `Order created: ${order.orderNumber}`);
  await createAuditLog({ studioId: studio.id, action: "order.created", entityType: "Order", entityId: order.id });
  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function updateOrder(orderId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const existingOrder = await prisma.order.findFirstOrThrow({ where: { id: orderId, studioId: studio.id } });
  const status = enumValue(
    required(formData, "status"),
    safeJsonList(studio.settings?.workflowStatusesJson, defaultOrderStatuses),
    "Order status"
  );
  const paymentStatus = enumValue(required(formData, "paymentStatus"), paymentStatuses, "Payment status");
  const order = await prisma.order.update({
    where: { id: orderId, studioId: studio.id },
    data: {
      status,
      paymentStatus,
      deadline: dateValue(formData.get("deadline")),
      internalNotes: optional(formData, "internalNotes"),
      customerNotes: optional(formData, "customerNotes")
    }
  });
  await logActivity(order.studioId, `Order ${order.orderNumber} updated`);
  await createAuditLog({
    studioId: order.studioId,
    action: "order.edited",
    entityType: "Order",
    entityId: order.id,
    metadata: { status, paymentStatus }
  });
  if (existingOrder.status !== status) {
    await createAuditLog({
      studioId: order.studioId,
      action: "order.status_changed",
      entityType: "Order",
      entityId: order.id,
      metadata: { from: existingOrder.status, to: status }
    });
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${order.id}`);
  redirect(`/orders/${order.id}`);
}

export async function addOrderItem(formData: FormData) {
  const studio = await getActiveStudio();
  const orderId = required(formData, "orderId");
  const order = await prisma.order.findFirstOrThrow({ where: { id: orderId, studioId: studio.id } });
  const imageRef = required(formData, "imageRef");
  const productId = required(formData, "productId");
  const product = await prisma.product.findFirstOrThrow({ where: { id: productId, studioId: order.studioId, active: true } });
  const quantity = quantityValue(formData);
  const retouchType = enumValue(
    required(formData, "retouchType"),
    safeJsonList(studio.settings?.retouchTypesJson, ["None", "Standard", "Advanced"]),
    "Retouch type"
  );
  const frameId = optional(formData, "frameId");
  let frame: { size: string } | null = null;
  if (frameId) {
    frame = await prisma.frame.findFirstOrThrow({ where: { id: frameId, studioId: order.studioId, active: true } });
  }
  const retoucherId = optional(formData, "retoucherId");
  if (retoucherId) {
    await prisma.retoucher.findFirstOrThrow({ where: { id: retoucherId, studioId: order.studioId, active: true } });
  }
  const urgent = formData.get("urgent") === "on";
  const retouchNotes = optional(formData, "retouchNotes");
  const size = sizeValue(formData, product);
  validateFrameForSize(frame, size);

  const item = await prisma.orderItem.create({
    data: {
      orderId,
      imageRef,
      productId,
      frameId,
      quantity,
      size,
      variant: enumValue(required(formData, "variant"), ["Color", "Black and white", "Both"], "Variant"),
      retouchType,
      retouchNotes,
      urgent,
      blackAndWhite: formData.get("blackAndWhite") === "on",
      status: "New"
    }
  });

  await syncRetouchTask({
    studioId: order.studioId,
    orderItemId: item.id,
    assignedRetoucherId: retoucherId,
    retouchType,
    retouchNotes,
    deadline: order.deadline,
    urgent
  });

  await recalculateOrderTotal(orderId, order.studioId);
  await logActivity(order.studioId, `Image added to order ${order.orderNumber}: ${imageRef}`);
  await createAuditLog({
    studioId: order.studioId,
    action: "order_item.created",
    entityType: "OrderItem",
    entityId: item.id,
    metadata: { orderId, imageRef }
  });
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function bulkAddOrderItems(formData: FormData) {
  const studio = await getActiveStudio();
  const orderId = required(formData, "orderId");
  const order = await prisma.order.findFirstOrThrow({ where: { id: orderId, studioId: studio.id } });
  const imageRefs = imageReferenceList(formData.get("imageRefs"));
  if (imageRefs.length === 0) {
    throw new Error("Add at least one image filename or number");
  }

  const productId = required(formData, "productId");
  const product = await prisma.product.findFirstOrThrow({ where: { id: productId, studioId: order.studioId, active: true } });
  const frameId = optional(formData, "frameId");
  let frame: { size: string } | null = null;
  if (frameId) {
    frame = await prisma.frame.findFirstOrThrow({ where: { id: frameId, studioId: order.studioId, active: true } });
  }
  const retoucherId = optional(formData, "retoucherId");
  if (retoucherId) {
    await prisma.retoucher.findFirstOrThrow({ where: { id: retoucherId, studioId: order.studioId, active: true } });
  }
  const quantity = quantityValue(formData);
  const retouchType = enumValue(
    required(formData, "retouchType"),
    safeJsonList(studio.settings?.retouchTypesJson, ["None", "Standard", "Advanced"]),
    "Retouch type"
  );
  const retouchNotes = optional(formData, "retouchNotes");
  const urgent = formData.get("urgent") === "on";
  const blackAndWhite = formData.get("blackAndWhite") === "on";
  const size = sizeValue(formData, product);
  validateFrameForSize(frame, size);
  const variant = enumValue(required(formData, "variant"), ["Color", "Black and white", "Both"], "Variant");

  const createdItemIds = await prisma.$transaction(async (tx) => {
    const itemIds: string[] = [];
    for (const imageRef of imageRefs) {
      const item = await tx.orderItem.create({
        data: {
          orderId,
          imageRef,
          productId,
          frameId,
          quantity,
          size,
          variant,
          retouchType,
          retouchNotes,
          urgent,
          blackAndWhite,
          status: "New"
        }
      });
      itemIds.push(item.id);
    }
    return itemIds;
  });
  for (const orderItemId of createdItemIds) {
    await syncRetouchTask({
      studioId: order.studioId,
      orderItemId,
      assignedRetoucherId: retoucherId,
      retouchType,
      retouchNotes,
      deadline: order.deadline,
      urgent
    });
  }

  await recalculateOrderTotal(orderId, order.studioId);
  await logActivity(order.studioId, `${imageRefs.length} images added to order ${order.orderNumber}`);
  await createAuditLog({
    studioId: order.studioId,
    action: "order_item.created",
    entityType: "Order",
    entityId: order.id,
    metadata: { count: imageRefs.length }
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}`);
}

export async function updateOrderItem(itemId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const existingItem = await prisma.orderItem.findFirstOrThrow({
    where: { id: itemId, order: { studioId: studio.id } },
    include: { order: true, retouchTask: true }
  });
  const productId = required(formData, "productId");
  const product = await prisma.product.findFirstOrThrow({
    where: {
      id: productId,
      studioId: existingItem.order.studioId,
      OR: [{ active: true }, { id: existingItem.productId }]
    }
  });
  const frameId = optional(formData, "frameId");
  let frame: { size: string } | null = null;
  if (frameId) {
    frame = await prisma.frame.findFirstOrThrow({
      where: {
        id: frameId,
        studioId: existingItem.order.studioId,
        OR: [{ active: true }, ...(existingItem.frameId ? [{ id: existingItem.frameId }] : [])]
      }
    });
  }
  const retoucherId = optional(formData, "retoucherId");
  if (retoucherId) {
    await prisma.retoucher.findFirstOrThrow({
      where: { id: retoucherId, studioId: existingItem.order.studioId, active: true }
    });
  }
  const retouchType = enumValue(
    required(formData, "retouchType"),
    safeJsonList(studio.settings?.retouchTypesJson, ["None", "Standard", "Advanced"]),
    "Retouch type"
  );
  const size = sizeValue(formData, product);
  validateFrameForSize(frame, size);
  const status = enumValue(required(formData, "status"), orderItemStatuses, "Order item status");
  const retouchNotes = optional(formData, "retouchNotes");
  const urgent = formData.get("urgent") === "on";

  const item = await prisma.orderItem.update({
    where: { id: existingItem.id },
    data: {
      imageRef: required(formData, "imageRef"),
      productId,
      frameId,
      quantity: quantityValue(formData),
      size,
      variant: enumValue(required(formData, "variant"), ["Color", "Black and white", "Both"], "Variant"),
      retouchType,
      retouchNotes,
      urgent,
      blackAndWhite: formData.get("blackAndWhite") === "on",
      status
    }
  });

  if (inactiveOrderItemStatuses.includes(status)) {
    if (existingItem.retouchTask) {
      await prisma.retouchTask.update({
        where: { id: existingItem.retouchTask.id, studioId: existingItem.order.studioId },
        data: { status: "Cancelled", urgent: false }
      });
    }
  } else {
    await syncRetouchTask({
      studioId: existingItem.order.studioId,
      orderItemId: item.id,
      assignedRetoucherId: retoucherId,
      retouchType,
      retouchNotes,
      deadline: existingItem.order.deadline,
      urgent
    });
  }

  await recalculateOrderTotal(existingItem.orderId, existingItem.order.studioId);
  await logActivity(existingItem.order.studioId, `Order ${existingItem.order.orderNumber} item updated: ${item.imageRef}`);
  await createAuditLog({
    studioId: existingItem.order.studioId,
    action: inactiveOrderItemStatuses.includes(status) ? "order_item.cancelled" : "order_item.edited",
    entityType: "OrderItem",
    entityId: item.id,
    metadata: { orderId: existingItem.orderId, status }
  });
  revalidatePath(`/orders/${existingItem.orderId}`);
  redirect(`/orders/${existingItem.orderId}`);
}

export async function cancelOrderItem(itemId: string) {
  const studio = await getActiveStudio();
  const item = await prisma.orderItem.findFirstOrThrow({
    where: { id: itemId, order: { studioId: studio.id } },
    include: { order: true, retouchTask: true }
  });
  await prisma.orderItem.update({
    where: { id: item.id },
    data: { status: "Cancelled" }
  });
  if (item.retouchTask) {
    await prisma.retouchTask.update({
      where: { id: item.retouchTask.id, studioId: item.order.studioId },
      data: { status: "Cancelled", urgent: false }
    });
  }
  await recalculateOrderTotal(item.orderId, item.order.studioId);
  await logActivity(item.order.studioId, `Order ${item.order.orderNumber} item cancelled: ${item.imageRef}`);
  await createAuditLog({
    studioId: item.order.studioId,
    action: "order_item.cancelled",
    entityType: "OrderItem",
    entityId: item.id,
    metadata: { orderId: item.orderId }
  });
  revalidatePath(`/orders/${item.orderId}`);
}

export async function updateOrderStatus(orderId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const status = enumValue(
    required(formData, "status"),
    safeJsonList(studio.settings?.workflowStatusesJson, defaultOrderStatuses),
    "Order status"
  );
  const order = await prisma.order.update({ where: { id: orderId, studioId: studio.id }, data: { status } });
  await logActivity(order.studioId, `Order ${order.orderNumber} changed to ${status}`);
  await createAuditLog({
    studioId: order.studioId,
    action: "order.status_changed",
    entityType: "Order",
    entityId: order.id,
    metadata: { status }
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
}

export async function updateRetouchTaskStatus(taskId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const status = enumValue(
    required(formData, "status"),
    retouchStatuses,
    "Retouch task status"
  );
  const existingTask = await prisma.retouchTask.findFirstOrThrow({
    where: { id: taskId, studioId: studio.id },
    include: { orderItem: { include: { order: true } } }
  });
  const task = await prisma.retouchTask.update({
    where: { id: existingTask.id, studioId: studio.id },
    data: { status }
  });
  await prisma.orderItem.update({
    where: { id: existingTask.orderItemId },
    data: { status: orderItemStatusForRetouchStatus(status) }
  });
  await logActivity(task.studioId, `Retouch task for ${existingTask.orderItem.imageRef} changed to ${status}`);
  await createAuditLog({
    studioId: task.studioId,
    action: "retouch_task.changed",
    entityType: "RetouchTask",
    entityId: task.id,
    metadata: { status, orderId: existingTask.orderItem.orderId }
  });
  revalidatePath("/retouch");
  revalidatePath(`/retouch/${task.id}`);
  revalidatePath(`/orders/${existingTask.orderItem.orderId}`);
  const target = returnToPath(formData, "/retouch");
  if (target !== "/retouch") redirect(target);
}

export async function updateRetouchTask(taskId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const existingTask = await prisma.retouchTask.findFirstOrThrow({
    where: { id: taskId, studioId: studio.id },
    include: { orderItem: { include: { order: true } } }
  });
  const status = enumValue(required(formData, "status"), retouchStatuses, "Retouch task status");
  const assignedRetoucherId = optional(formData, "assignedRetoucherId");
  if (assignedRetoucherId) {
    await prisma.retoucher.findFirstOrThrow({ where: { id: assignedRetoucherId, studioId: studio.id, active: true } });
  }
  const retouchType = enumValue(
    required(formData, "retouchType"),
    safeJsonList(studio.settings?.retouchTypesJson, ["None", "Standard", "Advanced"]),
    "Retouch type"
  );
  const notes = optional(formData, "notes");
  const deadline = dateValue(formData.get("deadline"));
  const urgent = formData.get("urgent") === "on";

  const task = await prisma.retouchTask.update({
    where: { id: existingTask.id, studioId: studio.id },
    data: {
      assignedRetoucherId,
      retouchType,
      notes,
      deadline,
      urgent,
      status
    }
  });
  await prisma.orderItem.update({
    where: { id: existingTask.orderItemId },
    data: {
      retouchType,
      retouchNotes: notes,
      urgent,
      status: orderItemStatusForRetouchStatus(status)
    }
  });
  await logActivity(studio.id, `Retouch task updated for ${existingTask.orderItem.imageRef}`);
  await createAuditLog({
    studioId: studio.id,
    action: "retouch_task.changed",
    entityType: "RetouchTask",
    entityId: task.id,
    metadata: { status, assignedRetoucherId, orderId: existingTask.orderItem.orderId }
  });
  revalidatePath("/retouch");
  revalidatePath(`/retouch/${task.id}`);
  revalidatePath(`/orders/${existingTask.orderItem.orderId}`);
  redirect(`/retouch/${task.id}`);
}

export async function generateMissingRetouchTasks(formData: FormData) {
  const studio = await getActiveStudio();
  const orderId = optional(formData, "orderId");
  if (orderId) {
    await prisma.order.findFirstOrThrow({ where: { id: orderId, studioId: studio.id } });
  }
  const items = await prisma.orderItem.findMany({
    where: {
      status: { notIn: inactiveOrderItemStatuses },
      order: { studioId: studio.id, ...(orderId ? { id: orderId } : {}) },
      OR: [{ retouchType: { not: "None" } }, { retouchNotes: { not: null } }, { urgent: true }]
    },
    include: { order: true, retouchTask: true }
  });

  let createdCount = 0;
  let reopenedCount = 0;
  for (const item of items) {
    if (!item.retouchTask) {
      await prisma.retouchTask.create({
        data: {
          studioId: studio.id,
          orderItemId: item.id,
          retouchType: item.retouchType,
          notes: item.retouchNotes,
          deadline: item.order.deadline,
          urgent: item.urgent,
          status: "Not started"
        }
      });
      createdCount += 1;
    } else if (item.retouchTask.status === "Cancelled") {
      await prisma.retouchTask.update({
        where: { id: item.retouchTask.id, studioId: studio.id },
        data: {
          retouchType: item.retouchType,
          notes: item.retouchNotes,
          deadline: item.order.deadline,
          urgent: item.urgent,
          status: "Not started"
        }
      });
      reopenedCount += 1;
    }
  }

  await logActivity(studio.id, `Generated ${createdCount} missing retouch task(s), reopened ${reopenedCount}.`);
  await createAuditLog({
    studioId: studio.id,
    action: "retouch_task.changed",
    entityType: orderId ? "Order" : "RetouchTask",
    entityId: orderId,
    metadata: { createdCount, reopenedCount }
  });
  revalidatePath("/retouch");
  revalidatePath("/dashboard");
  if (orderId) revalidatePath(`/orders/${orderId}`);
  redirect(returnToPath(formData, "/retouch"));
}

export async function createProduct(formData: FormData) {
  const studio = await getActiveStudio();
  const product = await prisma.product.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      type: required(formData, "type"),
      price: priceValue(formData),
      sizeOptionsJson: jsonListFromRequiredTextarea(formData.get("sizeOptions"), "Default size options"),
      active: formData.get("active") === "on"
    }
  });
  await createAuditLog({ studioId: studio.id, action: "create_product", entityType: "Product", entityId: product.id });
  revalidatePath("/products");
}

export async function updateProduct(productId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const existingProduct = await prisma.product.findFirstOrThrow({ where: { id: productId, studioId: studio.id } });
  const product = await prisma.product.update({
    where: { id: existingProduct.id },
    data: {
      name: required(formData, "name"),
      type: required(formData, "type"),
      price: priceValue(formData),
      sizeOptionsJson: jsonListFromRequiredTextarea(formData.get("sizeOptions"), "Default size options"),
      active: formData.get("active") === "on"
    }
  });
  await createAuditLog({ studioId: studio.id, action: "update_product", entityType: "Product", entityId: product.id });
  revalidatePath("/products");
  redirect("/products");
}

export async function toggleProductActive(productId: string) {
  const studio = await getActiveStudio();
  const existingProduct = await prisma.product.findFirstOrThrow({ where: { id: productId, studioId: studio.id } });
  const product = await prisma.product.update({
    where: { id: existingProduct.id },
    data: { active: !existingProduct.active }
  });
  await createAuditLog({
    studioId: studio.id,
    action: product.active ? "activate_product" : "deactivate_product",
    entityType: "Product",
    entityId: product.id
  });
  revalidatePath("/products");
}

export async function createFrame(formData: FormData) {
  const studio = await getActiveStudio();
  const frame = await prisma.frame.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      size: required(formData, "size"),
      color: required(formData, "color"),
      price: priceValue(formData),
      active: formData.get("active") === "on"
    }
  });
  await createAuditLog({ studioId: studio.id, action: "create_frame", entityType: "Frame", entityId: frame.id });
  revalidatePath("/products");
}

export async function updateFrame(frameId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const existingFrame = await prisma.frame.findFirstOrThrow({ where: { id: frameId, studioId: studio.id } });
  const frame = await prisma.frame.update({
    where: { id: existingFrame.id },
    data: {
      name: required(formData, "name"),
      size: required(formData, "size"),
      color: required(formData, "color"),
      price: priceValue(formData),
      active: formData.get("active") === "on"
    }
  });
  await createAuditLog({ studioId: studio.id, action: "update_frame", entityType: "Frame", entityId: frame.id });
  revalidatePath("/products");
  redirect("/products");
}

export async function toggleFrameActive(frameId: string) {
  const studio = await getActiveStudio();
  const existingFrame = await prisma.frame.findFirstOrThrow({ where: { id: frameId, studioId: studio.id } });
  const frame = await prisma.frame.update({
    where: { id: existingFrame.id },
    data: { active: !existingFrame.active }
  });
  await createAuditLog({
    studioId: studio.id,
    action: frame.active ? "activate_frame" : "deactivate_frame",
    entityType: "Frame",
    entityId: frame.id
  });
  revalidatePath("/products");
}

export async function createRetoucher(formData: FormData) {
  const studio = await getActiveStudio();
  const retoucher = await prisma.retoucher.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      email: required(formData, "email"),
      phone: optional(formData, "phone"),
      notes: optional(formData, "notes"),
      active: formData.get("active") === "on"
    }
  });
  await createAuditLog({ studioId: studio.id, action: "create_retoucher", entityType: "Retoucher", entityId: retoucher.id });
  revalidatePath("/retouchers");
}

export async function createEmailTemplate(formData: FormData) {
  const studio = await getActiveStudio();
  const template = await prisma.emailTemplate.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      type: enumValue(required(formData, "type"), emailTemplateTypes, "Email template type"),
      subject: required(formData, "subject"),
      body: required(formData, "body"),
      active: formData.get("active") === "on"
    }
  });
  await createAuditLog({
    studioId: studio.id,
    action: "create_email_template",
    entityType: "EmailTemplate",
    entityId: template.id
  });
  revalidatePath("/email-templates");
  redirect("/email-templates");
}

export async function updateEmailTemplate(templateId: string, formData: FormData) {
  const studio = await getActiveStudio();
  const existingTemplate = await prisma.emailTemplate.findFirstOrThrow({ where: { id: templateId, studioId: studio.id } });
  const template = await prisma.emailTemplate.update({
    where: { id: existingTemplate.id },
    data: {
      name: required(formData, "name"),
      type: enumValue(required(formData, "type"), emailTemplateTypes, "Email template type"),
      subject: required(formData, "subject"),
      body: required(formData, "body"),
      active: formData.get("active") === "on"
    }
  });
  await createAuditLog({
    studioId: studio.id,
    action: "update_email_template",
    entityType: "EmailTemplate",
    entityId: template.id
  });
  revalidatePath("/email-templates");
  redirect("/email-templates");
}

export async function toggleEmailTemplateActive(templateId: string) {
  const studio = await getActiveStudio();
  const existingTemplate = await prisma.emailTemplate.findFirstOrThrow({ where: { id: templateId, studioId: studio.id } });
  const template = await prisma.emailTemplate.update({
    where: { id: existingTemplate.id },
    data: { active: !existingTemplate.active }
  });
  await createAuditLog({
    studioId: studio.id,
    action: template.active ? "activate_email_template" : "deactivate_email_template",
    entityType: "EmailTemplate",
    entityId: template.id
  });
  revalidatePath("/email-templates");
}

export async function logEmailAsPrepared(formData: FormData) {
  const studio = await getActiveStudio();
  const orderId = required(formData, "orderId");
  const templateId = required(formData, "templateId");
  const [order, template] = await Promise.all([
    prisma.order.findFirstOrThrow({
      where: { id: orderId, studioId: studio.id },
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
    }),
    prisma.emailTemplate.findFirstOrThrow({ where: { id: templateId, studioId: studio.id } })
  ]);
  const subject = generateTemplateSubject(template.subject, order);
  const body = generateTemplateBody(template.body, order);
  const recommendedRecipient = recommendedEmailRecipient(template.type, order);
  const toEmail = optional(formData, "toEmail") ?? (recommendedRecipient || null);
  const log = await prisma.emailLog.create({
    data: {
      studioId: studio.id,
      orderId: order.id,
      templateId: template.id,
      toEmail,
      subject,
      body,
      status: "Prepared"
    }
  });
  await logActivity(studio.id, `Prepared email logged for ${order.orderNumber}: ${template.name}`);
  await createAuditLog({
    studioId: studio.id,
    action: "email.prepared",
    entityType: "EmailLog",
    entityId: log.id,
    metadata: { orderId: order.id, templateId: template.id }
  });
  revalidatePath("/email-templates");
  revalidatePath(`/email-logs/${log.id}`);
  redirect(returnToPath(formData, `/email-logs/${log.id}`));
}

export async function updateSettings(formData: FormData) {
  const studio = await getActiveStudio();
  await prisma.studio.update({
    where: { id: studio.id },
    data: {
      name: required(formData, "studioName"),
      country: required(formData, "country"),
      timezone: timezoneValue(formData)
    }
  });
  const settings = await prisma.studioSettings.upsert({
    where: { studioId: studio.id },
    update: {
      orderIdFormat: required(formData, "orderIdFormat"),
      defaultFolderPath: required(formData, "defaultFolderPath"),
      folderNamingFormat: required(formData, "folderNamingFormat"),
      workflowStatusesJson: jsonListFromRequiredTextarea(formData.get("workflowStatuses"), "Workflow statuses"),
      sessionTypesJson: jsonListFromRequiredTextarea(formData.get("sessionTypes"), "Session types"),
      retouchTypesJson: jsonListFromRequiredTextarea(formData.get("retouchTypes"), "Retouch types"),
      photographersJson: jsonListFromRequiredTextarea(formData.get("photographers"), "Photographers"),
      captureTool: enumValue(required(formData, "captureTool"), captureTools, "Capture tool")
    },
    create: {
      studioId: studio.id,
      orderIdFormat: required(formData, "orderIdFormat"),
      defaultFolderPath: required(formData, "defaultFolderPath"),
      folderNamingFormat: required(formData, "folderNamingFormat"),
      workflowStatusesJson: jsonListFromRequiredTextarea(formData.get("workflowStatuses"), "Workflow statuses"),
      sessionTypesJson: jsonListFromRequiredTextarea(formData.get("sessionTypes"), "Session types"),
      retouchTypesJson: jsonListFromRequiredTextarea(formData.get("retouchTypes"), "Retouch types"),
      photographersJson: jsonListFromRequiredTextarea(formData.get("photographers"), "Photographers"),
      captureTool: enumValue(required(formData, "captureTool"), captureTools, "Capture tool")
    }
  });
  await createAuditLog({ studioId: studio.id, action: "settings.changed", entityType: "StudioSettings", entityId: settings.id });
  revalidatePath("/settings");
}

export async function createBridgeTestFolders(formData: FormData) {
  const context = await getActiveStudioContext();
  const studio = context.studio;
  const orderId = required(formData, "orderId");
  const dryRun = formData.get("dryRun") !== "false";
  const order = await prisma.order.findFirstOrThrow({
    where: { id: orderId, studioId: studio.id },
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
  const plan = buildFolderPlan(order);
  const bridgeJob = await prisma.bridgeJob.create({
    data: {
      studioId: order.studioId,
      orderId: order.id,
      requestedByUserId: context.user.id,
      type: dryRun ? "Preview folder plan" : "Create safe test folders",
      dryRun,
      status: dryRun ? "Previewed" : "Running"
    }
  });
  await createAuditLog({
    studioId: order.studioId,
    userId: context.user.id,
    action: "bridge_job.created",
    entityType: "BridgeJob",
    entityId: bridgeJob.id,
    metadata: { orderId: order.id, dryRun, type: bridgeJob.type }
  });

  if (!dryRun) {
    try {
      await assertBridgeAutomationAvailable(order.studioId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bridge automation is not available on this plan.";
      const usage = await getPlanUsage(order.studioId);
      await prisma.$transaction([
        prisma.bridgeJob.update({ where: { id: bridgeJob.id }, data: { status: "Blocked" } }),
        prisma.bridgeLog.create({
          data: {
            studioId: order.studioId,
            bridgeJobId: bridgeJob.id,
            action: "Plan limit blocked",
            status: "Blocked",
            message
          }
        }),
        prisma.paymentEvent.create({
          data: {
            studioId: order.studioId,
            provider: LOCAL_BILLING_PROVIDER,
            eventType: "bridge.plan_limit_blocked",
            externalId: `local_evt_${crypto.randomUUID()}`,
            payloadJson: JSON.stringify({
              plan: usage.plan?.name ?? "No plan",
              bridgeAutomationAvailable: usage.bridgeAutomationAvailable,
              orderId: order.id,
              localOnly: true
            }),
            processedAt: new Date()
          }
        })
      ]);
      await createAuditLog({
        studioId: order.studioId,
        userId: context.user.id,
        action: "block_bridge_plan_limit",
        entityType: "BridgeJob",
        entityId: bridgeJob.id,
        metadata: { orderId: order.id, message }
      });
      revalidatePath("/local-bridge");
      redirect(`/local-bridge?orderId=${orderId}&bridgeMessage=${encodeURIComponent(message)}`);
    }
  }

  const approvedRoot = approvedBridgeSafeRoot();
  const unsafeReason =
    path.resolve(plan.safeRoot) !== approvedRoot
      ? `Safe root mismatch. Expected ${approvedRoot}, received ${plan.safeRoot}.`
      : plan.targetPaths
          .map((target) => path.resolve(target))
          .find((target) => !isInsideSafeRoot(target, plan.safeRoot))
        ? `Target path is outside the approved safe folder: ${
            plan.targetPaths.map((target) => path.resolve(target)).find((target) => !isInsideSafeRoot(target, plan.safeRoot))
          }`
        : null;

  if (unsafeReason) {
    await prisma.$transaction([
      prisma.bridgeJob.update({ where: { id: bridgeJob.id }, data: { status: "Blocked" } }),
      prisma.bridgeLog.create({
        data: {
          studioId: order.studioId,
          bridgeJobId: bridgeJob.id,
          action: "Unsafe path blocked",
          status: "Blocked",
          message: `${unsafeReason} StudioFlow did not create folders or files.`
        }
      })
    ]);
    await createAuditLog({
      studioId: order.studioId,
      userId: context.user.id,
      action: "block_unsafe_bridge_path",
      entityType: "BridgeJob",
      entityId: bridgeJob.id,
      metadata: { orderId: order.id, safeRoot: plan.safeRoot, targetPaths: plan.targetPaths }
    });
    revalidatePath("/local-bridge");
    redirect(`/local-bridge?orderId=${orderId}&bridgeMessage=${encodeURIComponent("Unsafe path blocked. Nothing was created.")}`);
  }

  if (dryRun) {
    await prisma.bridgeLog.create({
      data: {
        studioId: order.studioId,
        bridgeJobId: bridgeJob.id,
        action: "Dry-run folder plan",
        status: "Preview",
        message: `Previewed ${plan.folders.length} folder(s) and ${plan.files.length} file(s) for ${order.orderNumber}. Nothing was created.`
      }
    });
    await createAuditLog({
      studioId: order.studioId,
      userId: context.user.id,
      action: "preview_bridge_folder_plan",
      entityType: "BridgeJob",
      entityId: bridgeJob.id,
      metadata: { orderId: order.id, relativeRoot: plan.relativeRoot, folderCount: plan.folders.length, fileCount: plan.files.length }
    });
    revalidatePath("/local-bridge");
    redirect(`/local-bridge?orderId=${orderId}&bridgeMessage=${encodeURIComponent("Dry-run preview created. Nothing was created.")}`);
  }

  let createdFolders = 0;
  let skippedFolders = 0;
  let createdFiles = 0;
  let skippedFiles = 0;
  const logs: Array<{ studioId: string; bridgeJobId: string; action: string; status: string; message: string }> = [];
  try {
    await fs.mkdir(plan.safeRoot, { recursive: true });

    for (const folder of plan.folders) {
      if (!isInsideSafeRoot(folder.absolutePath, plan.safeRoot)) {
        throw new Error(`Unsafe folder target blocked: ${folder.absolutePath}`);
      }
      if (await pathExists(folder.absolutePath)) {
        skippedFolders += 1;
        logs.push({
          studioId: order.studioId,
          bridgeJobId: bridgeJob.id,
          action: "Skipped existing folder",
          status: "Skipped",
          message: folder.relativePath
        });
      } else {
        await fs.mkdir(folder.absolutePath, { recursive: true });
        createdFolders += 1;
        logs.push({
          studioId: order.studioId,
          bridgeJobId: bridgeJob.id,
          action: "Created folder",
          status: "Created",
          message: folder.relativePath
        });
      }
    }

    for (const file of plan.files) {
      if (!isInsideSafeRoot(file.absolutePath, plan.safeRoot)) {
        throw new Error(`Unsafe file target blocked: ${file.absolutePath}`);
      }
      try {
        await fs.writeFile(file.absolutePath, file.content, { encoding: "utf8", flag: "wx" });
        createdFiles += 1;
        await prisma.generatedFile.create({
          data: {
            studioId: order.studioId,
            orderId: order.id,
            bridgeJobId: bridgeJob.id,
            fileType: file.fileType,
            path: file.absolutePath,
            checksum: contentChecksum(file.content)
          }
        });
        logs.push({
          studioId: order.studioId,
          bridgeJobId: bridgeJob.id,
          action: "Created file",
          status: "Created",
          message: file.relativePath
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        skippedFiles += 1;
        logs.push({
          studioId: order.studioId,
          bridgeJobId: bridgeJob.id,
          action: "Skipped existing file",
          status: "Skipped",
          message: `${file.relativePath} already exists and was not overwritten.`
        });
      }
    }

    logs.push({
      studioId: order.studioId,
      bridgeJobId: bridgeJob.id,
      action: "Create safe test folders",
      status: "Completed",
      message: `Created ${createdFolders} folder(s), skipped ${skippedFolders}, created ${createdFiles} file(s), skipped ${skippedFiles} for ${order.orderNumber}.`
    });

    await prisma.$transaction([
      prisma.bridgeLog.createMany({ data: logs }),
      prisma.bridgeJob.update({ where: { id: bridgeJob.id }, data: { status: "Completed" } })
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown bridge automation error";
    await prisma.$transaction([
      prisma.bridgeJob.update({ where: { id: bridgeJob.id }, data: { status: "Failed" } }),
      prisma.bridgeLog.create({
        data: {
          studioId: order.studioId,
          bridgeJobId: bridgeJob.id,
          action: "Create safe test folders",
          status: "Failed",
          message
        }
      })
    ]);
    await createAuditLog({
      studioId: order.studioId,
      userId: context.user.id,
      action: "fail_bridge_test_folder_creation",
      entityType: "BridgeJob",
      entityId: bridgeJob.id,
      metadata: { orderId: order.id, message }
    });
    revalidatePath("/local-bridge");
    redirect(`/local-bridge?orderId=${orderId}&bridgeMessage=${encodeURIComponent(`Bridge action failed: ${message}`)}`);
  }

  await createAuditLog({
    studioId: order.studioId,
    userId: context.user.id,
    action: "create_bridge_test_folders",
    entityType: "BridgeJob",
    entityId: bridgeJob.id,
    metadata: {
      orderId: order.id,
      relativeRoot: plan.relativeRoot,
      createdFolders,
      skippedFolders,
      createdFiles,
      skippedFiles
    }
  });
  revalidatePath("/local-bridge");
  redirect(
    `/local-bridge?orderId=${orderId}&bridgeMessage=${encodeURIComponent(
      `Safe test run completed. Created ${createdFolders} folder(s), skipped ${skippedFolders}, created ${createdFiles} file(s), skipped ${skippedFiles}.`
    )}`
  );
}
