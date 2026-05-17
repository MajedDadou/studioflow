import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const STUDIO_COOKIE = "studioflow_studio";

export async function getStudios() {
  return prisma.studio.findMany({
    orderBy: { name: "asc" },
    include: {
      subscription: { include: { plan: true } }
    }
  });
}

export async function getActiveStudio() {
  const cookieStore = await cookies();
  const studioId = cookieStore.get(STUDIO_COOKIE)?.value;
  const studio =
    (studioId &&
      (await prisma.studio.findUnique({
        where: { id: studioId },
        include: {
          settings: true,
          subscription: { include: { plan: true } }
        }
      }))) ||
    (await prisma.studio.findFirst({
      orderBy: { name: "asc" },
      include: {
        settings: true,
        subscription: { include: { plan: true } }
      }
    }));

  if (!studio) {
    throw new Error("No studio found. Run `npm run seed` first.");
  }

  return studio;
}
