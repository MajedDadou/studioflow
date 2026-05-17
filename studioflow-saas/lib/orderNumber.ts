import { prisma } from "@/lib/prisma";
import { studioCode } from "@/lib/format";

export async function generateOrderNumber(studioId: string, studioName: string, format: string) {
  const now = new Date();
  const year = String(now.getFullYear());
  const date = `${year}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const count = await prisma.order.count({
    where: {
      studioId,
      orderDate: {
        gte: new Date(now.getFullYear(), 0, 1),
        lt: new Date(now.getFullYear() + 1, 0, 1)
      }
    }
  });
  const sequence = count + 1;

  return format
    .replaceAll("{studioCode}", studioCode(studioName))
    .replaceAll("{year}", year)
    .replaceAll("{date}", date)
    .replaceAll("{sequence3}", String(sequence).padStart(3, "0"))
    .replaceAll("{sequence4}", String(sequence).padStart(4, "0"));
}
