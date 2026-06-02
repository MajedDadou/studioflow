import type { Order, OrderItem, Product, Frame, Customer, PhotoSession, RetouchTask, Retoucher } from "@prisma/client";
import { formatDate, formatMoney } from "@/lib/format";

export const emailTemplateTypes = [
  "Retouch task email",
  "Customer order confirmation",
  "Order ready for pickup/delivery",
  "Internal note"
];

const legacyTemplateTypeMap: Record<string, string> = {
  Retouch: "Retouch task email",
  "Customer confirmation": "Customer order confirmation",
  Ready: "Order ready for pickup/delivery",
  Internal: "Internal note"
};

export type FullOrderForEmail = Order & {
  customer: Customer;
  session: PhotoSession;
  items: Array<
    OrderItem & {
      product: Product;
      frame: Frame | null;
      retouchTask: (RetouchTask & { assignedRetoucher: Retoucher | null }) | null;
    }
  >;
};

export function normalizeEmailTemplateType(type: string) {
  return legacyTemplateTypeMap[type] ?? type;
}

export function activeEmailItems(order: FullOrderForEmail) {
  return order.items.filter((item) => item.status !== "Cancelled" && item.status !== "Inactive");
}

export function selectedImageLines(order: FullOrderForEmail) {
  const lines = activeEmailItems(order).map((item) => {
    const frame = item.frame ? `, frame: ${item.frame.name}` : "";
    const bw = item.blackAndWhite ? ", black and white" : "";
    return `- ${item.imageRef}: ${item.quantity} x ${item.product.name}, ${item.size}, ${item.variant}${frame}${bw}`;
  });
  return lines.join("\n") || "- No selected images";
}

export function retouchInstructionLines(order: FullOrderForEmail) {
  const lines = activeEmailItems(order)
    .filter((item) => item.retouchType !== "None" || item.retouchNotes || item.urgent)
    .map((item) => {
      const retoucher = item.retouchTask?.assignedRetoucher?.name ?? "Unassigned";
      const deadline = item.retouchTask?.deadline ?? order.deadline;
      const urgent = item.urgent || item.retouchTask?.urgent ? "URGENT, " : "";
      return `- ${item.imageRef}: ${urgent}${item.retouchType}, retoucher: ${retoucher}, deadline: ${formatDate(deadline)}, notes: ${item.retouchNotes || item.retouchTask?.notes || "No notes"}`;
    });
  return lines.join("\n") || "- No retouch items";
}

export function assignedRetoucherLines(order: FullOrderForEmail) {
  const retouchers = new Set(
    activeEmailItems(order)
      .map((item) => item.retouchTask?.assignedRetoucher?.name)
      .filter(Boolean)
  );
  return [...retouchers].join(", ") || "Unassigned";
}

export function productLines(order: FullOrderForEmail) {
  const productLines = order.items
    .filter((item) => item.status !== "Cancelled" && item.status !== "Inactive")
    .map((item) => {
      const frame = item.frame ? `, frame: ${item.frame.name}` : "";
      const lineTotal = (item.product.price + (item.frame?.price ?? 0)) * item.quantity;
      return `- ${item.imageRef}: ${item.quantity} x ${item.product.name}${frame}, ${formatMoney(lineTotal)}`;
    })
    .join("\n");
  return productLines || "- No products";
}

export function recommendedEmailRecipient(templateType: string, order: FullOrderForEmail) {
  const normalized = normalizeEmailTemplateType(templateType);
  if (normalized === "Retouch task email") {
    const retoucherEmails = new Set(
      activeEmailItems(order)
        .map((item) => item.retouchTask?.assignedRetoucher?.email)
        .filter(Boolean)
    );
    return [...retoucherEmails].join(", ");
  }
  if (normalized === "Customer order confirmation" || normalized === "Order ready for pickup/delivery") {
    return order.customer.email ?? "";
  }
  return "";
}

export function generateTemplateBody(templateBody: string, order: FullOrderForEmail) {
  const retouchLines = retouchInstructionLines(order);
  const selectedImages = selectedImageLines(order);
  const products = productLines(order);
  const assignedRetouchers = assignedRetoucherLines(order);

  return templateBody
    .replaceAll("{orderId}", order.orderNumber)
    .replaceAll("{customerName}", order.customer.name)
    .replaceAll("{customerEmail}", order.customer.email ?? "")
    .replaceAll("{customerPhone}", order.customer.phone ?? "")
    .replaceAll("{sessionType}", order.session.sessionType)
    .replaceAll("{folderPath}", order.session.folderPath)
    .replaceAll("{deadline}", formatDate(order.deadline))
    .replaceAll("{orderTotal}", formatMoney(order.totalPrice))
    .replaceAll("{selectedImages}", selectedImages)
    .replaceAll("{retouchInstructions}", retouchLines)
    .replaceAll("{retouchLines}", retouchLines)
    .replaceAll("{assignedRetouchers}", assignedRetouchers)
    .replaceAll("{productLines}", products)
    .replaceAll("{internalNotes}", order.internalNotes ?? "")
    .replaceAll("{customerNotes}", order.customerNotes ?? "");
}

export function generateTemplateSubject(subject: string, order: FullOrderForEmail) {
  return subject
    .replaceAll("{orderId}", order.orderNumber)
    .replaceAll("{customerName}", order.customer.name)
    .replaceAll("{sessionType}", order.session.sessionType);
}
