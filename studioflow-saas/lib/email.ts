import type { Order, OrderItem, Product, Frame, Customer, PhotoSession, RetouchTask, Retoucher } from "@prisma/client";
import { formatDate, formatMoney } from "@/lib/format";

type FullOrder = Order & {
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

export function generateTemplateBody(templateBody: string, order: FullOrder) {
  const retouchLines = order.items
    .filter((item) => item.retouchType !== "None")
    .map((item) => {
      const retoucher = item.retouchTask?.assignedRetoucher?.name ?? "Unassigned";
      return `- ${item.imageRef}: ${item.retouchType}, ${retoucher}, ${item.retouchNotes || "No notes"}`;
    })
    .join("\n");

  const productLines = order.items
    .map((item) => {
      const frame = item.frame ? `, frame: ${item.frame.name}` : "";
      return `- ${item.imageRef}: ${item.quantity} x ${item.product.name}${frame}, ${formatMoney(item.product.price * item.quantity)}`;
    })
    .join("\n");

  return templateBody
    .replaceAll("{orderId}", order.orderNumber)
    .replaceAll("{customerName}", order.customer.name)
    .replaceAll("{customerEmail}", order.customer.email ?? "")
    .replaceAll("{customerPhone}", order.customer.phone ?? "")
    .replaceAll("{sessionType}", order.session.sessionType)
    .replaceAll("{folderPath}", order.session.folderPath)
    .replaceAll("{deadline}", formatDate(order.deadline))
    .replaceAll("{orderTotal}", formatMoney(order.totalPrice))
    .replaceAll("{retouchLines}", retouchLines || "- No retouch items")
    .replaceAll("{productLines}", productLines || "- No products")
    .replaceAll("{internalNotes}", order.internalNotes ?? "")
    .replaceAll("{customerNotes}", order.customerNotes ?? "");
}

export function generateTemplateSubject(subject: string, order: FullOrder) {
  return subject
    .replaceAll("{orderId}", order.orderNumber)
    .replaceAll("{customerName}", order.customer.name)
    .replaceAll("{sessionType}", order.session.sessionType);
}
