"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parsePriceToCents } from "@/lib/format";
import { STUDIO_COOKIE, getActiveStudio } from "@/lib/studio";
import { generateOrderNumber } from "@/lib/orderNumber";
import { buildFolderPlan } from "@/lib/folderPlan";

function required(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optional(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function dateValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return new Date(`${raw}T12:00:00`);
}

function jsonListFromTextarea(value: FormDataEntryValue | null) {
  return JSON.stringify(
    String(value ?? "")
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

async function logActivity(studioId: string, message: string) {
  await prisma.activity.create({ data: { studioId, message } });
}

async function recalculateOrderTotal(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    include: { product: true, frame: true }
  });
  const total = items.reduce((sum, item) => {
    const line = (item.product.price + (item.frame?.price ?? 0)) * item.quantity;
    return sum + line;
  }, 0);
  await prisma.order.update({ where: { id: orderId }, data: { totalPrice: total } });
}

export async function switchStudio(formData: FormData) {
  const studioId = required(formData, "studioId");
  const cookieStore = await cookies();
  cookieStore.set(STUDIO_COOKIE, studioId, { path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function createCustomer(formData: FormData) {
  const studio = await getActiveStudio();
  const customer = await prisma.customer.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      phone: optional(formData, "phone"),
      email: optional(formData, "email"),
      notes: optional(formData, "notes")
    }
  });
  await logActivity(studio.id, `Customer created: ${customer.name}`);
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: required(formData, "name"),
      phone: optional(formData, "phone"),
      email: optional(formData, "email"),
      notes: optional(formData, "notes")
    }
  });
  await logActivity(customer.studioId, `Customer updated: ${customer.name}`);
  revalidatePath("/customers");
  redirect(`/customers/${customer.id}`);
}

export async function createSession(formData: FormData) {
  const studio = await getActiveStudio();
  const customerId = required(formData, "customerId");
  const sessionDate = dateValue(formData.get("date"));
  if (!sessionDate) throw new Error("date is required");

  const session = await prisma.photoSession.create({
    data: {
      studioId: studio.id,
      customerId,
      sessionType: required(formData, "sessionType"),
      photographer: required(formData, "photographer"),
      date: sessionDate,
      folderPath: required(formData, "folderPath"),
      notes: optional(formData, "notes"),
      status: "New"
    }
  });
  await logActivity(studio.id, `Session created: ${session.sessionType}`);
  revalidatePath("/sessions");
  redirect(`/sessions/${session.id}`);
}

export async function createOrder(formData: FormData) {
  const studio = await getActiveStudio();
  const sessionId = required(formData, "sessionId");
  const session = await prisma.photoSession.findUniqueOrThrow({ where: { id: sessionId } });
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
      paymentStatus: "Not paid",
      internalNotes: optional(formData, "internalNotes"),
      customerNotes: optional(formData, "customerNotes")
    }
  });
  await logActivity(studio.id, `Order created: ${order.orderNumber}`);
  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function addOrderItem(formData: FormData) {
  const orderId = required(formData, "orderId");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const imageRef = required(formData, "imageRef");
  const quantity = Math.max(1, Number(formData.get("quantity") ?? 1));
  const retouchType = required(formData, "retouchType");
  const frameId = optional(formData, "frameId");
  const retoucherId = optional(formData, "retoucherId");
  const urgent = formData.get("urgent") === "on";

  const item = await prisma.orderItem.create({
    data: {
      orderId,
      imageRef,
      productId: required(formData, "productId"),
      frameId,
      quantity,
      size: optional(formData, "size") ?? "-",
      variant: required(formData, "variant"),
      retouchType,
      retouchNotes: optional(formData, "retouchNotes"),
      urgent,
      blackAndWhite: formData.get("blackAndWhite") === "on",
      status: "New"
    }
  });

  if (retouchType !== "None" || urgent || optional(formData, "retouchNotes")) {
    await prisma.retouchTask.create({
      data: {
        studioId: order.studioId,
        orderItemId: item.id,
        assignedRetoucherId: retoucherId,
        retouchType,
        notes: optional(formData, "retouchNotes"),
        deadline: order.deadline,
        urgent,
        status: "Not started"
      }
    });
  }

  await recalculateOrderTotal(orderId);
  await logActivity(order.studioId, `Image added to order ${order.orderNumber}: ${imageRef}`);
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function updateOrderStatus(orderId: string, formData: FormData) {
  const status = required(formData, "status");
  const order = await prisma.order.update({ where: { id: orderId }, data: { status } });
  await logActivity(order.studioId, `Order ${order.orderNumber} changed to ${status}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
}

export async function updateRetouchTaskStatus(taskId: string, formData: FormData) {
  const status = required(formData, "status");
  const task = await prisma.retouchTask.update({ where: { id: taskId }, data: { status } });
  await logActivity(task.studioId, `Retouch task changed to ${status}`);
  revalidatePath("/retouch");
}

export async function createProduct(formData: FormData) {
  const studio = await getActiveStudio();
  await prisma.product.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      type: required(formData, "type"),
      price: parsePriceToCents(formData.get("price")),
      active: formData.get("active") === "on"
    }
  });
  revalidatePath("/products");
}

export async function createFrame(formData: FormData) {
  const studio = await getActiveStudio();
  await prisma.frame.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      size: required(formData, "size"),
      color: required(formData, "color"),
      price: parsePriceToCents(formData.get("price")),
      active: formData.get("active") === "on"
    }
  });
  revalidatePath("/products");
}

export async function createRetoucher(formData: FormData) {
  const studio = await getActiveStudio();
  await prisma.retoucher.create({
    data: {
      studioId: studio.id,
      name: required(formData, "name"),
      email: required(formData, "email"),
      phone: optional(formData, "phone"),
      notes: optional(formData, "notes"),
      active: formData.get("active") === "on"
    }
  });
  revalidatePath("/retouchers");
}

export async function updateSettings(formData: FormData) {
  const studio = await getActiveStudio();
  await prisma.studio.update({
    where: { id: studio.id },
    data: { name: required(formData, "studioName") }
  });
  await prisma.studioSettings.upsert({
    where: { studioId: studio.id },
    update: {
      orderIdFormat: required(formData, "orderIdFormat"),
      defaultFolderPath: required(formData, "defaultFolderPath"),
      folderNamingFormat: required(formData, "folderNamingFormat"),
      workflowStatusesJson: jsonListFromTextarea(formData.get("workflowStatuses")),
      retouchTypesJson: jsonListFromTextarea(formData.get("retouchTypes")),
      photographersJson: jsonListFromTextarea(formData.get("photographers")),
      captureTool: required(formData, "captureTool")
    },
    create: {
      studioId: studio.id,
      orderIdFormat: required(formData, "orderIdFormat"),
      defaultFolderPath: required(formData, "defaultFolderPath"),
      folderNamingFormat: required(formData, "folderNamingFormat"),
      workflowStatusesJson: jsonListFromTextarea(formData.get("workflowStatuses")),
      retouchTypesJson: jsonListFromTextarea(formData.get("retouchTypes")),
      photographersJson: jsonListFromTextarea(formData.get("photographers")),
      captureTool: required(formData, "captureTool")
    }
  });
  revalidatePath("/settings");
}

export async function createBridgeTestFolders(formData: FormData) {
  const orderId = required(formData, "orderId");
  const dryRun = formData.get("dryRun") !== "false";
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
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

  if (dryRun) {
    await prisma.bridgeLog.create({
      data: {
        studioId: order.studioId,
        action: "Dry-run folder plan",
        status: "Preview",
        message: `Previewed folder plan for ${order.orderNumber}`
      }
    });
    redirect(`/local-bridge?orderId=${orderId}&bridgeMessage=Dry-run preview created`);
  }

  const safeRoot = path.join(process.cwd(), "safe-test-folder", "StudioFlow_Test");
  const allTargets = [...plan.folders, plan.summaryFile];
  for (const target of allTargets) {
    const relative = path.relative(safeRoot, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("Unsafe folder target blocked");
    }
  }

  await fs.mkdir(path.dirname(plan.summaryFile), { recursive: true });
  for (const folder of plan.folders) {
    await fs.mkdir(folder, { recursive: true });
  }

  let summaryStatus = "Skipped existing summary";
  try {
    await fs.writeFile(plan.summaryFile, plan.summaryContent, { encoding: "utf8", flag: "wx" });
    summaryStatus = "Created order-summary.txt";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }

  await prisma.bridgeLog.create({
    data: {
      studioId: order.studioId,
      action: "Create test folders",
      status: "Done",
      message: `${summaryStatus} for ${order.orderNumber} inside ${plan.relativeRoot}`
    }
  });
  revalidatePath("/local-bridge");
  redirect(`/local-bridge?orderId=${orderId}&bridgeMessage=Test folders created inside safe-test-folder only`);
}
