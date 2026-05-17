import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const dbPath = path.join(process.cwd(), "prisma", "dev.db");

const schemaSql = `
CREATE TABLE "Studio" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "StudioSettings" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "orderIdFormat" TEXT NOT NULL, "defaultFolderPath" TEXT NOT NULL, "folderNamingFormat" TEXT NOT NULL, "workflowStatusesJson" TEXT NOT NULL, "retouchTypesJson" TEXT NOT NULL, "photographersJson" TEXT NOT NULL, "captureTool" TEXT NOT NULL, CONSTRAINT "StudioSettings_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "Employee" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "role" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Employee_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "Customer" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "name" TEXT NOT NULL, "phone" TEXT, "email" TEXT, "notes" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Customer_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "PhotoSession" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "sessionType" TEXT NOT NULL, "photographer" TEXT NOT NULL, "date" DATETIME NOT NULL, "folderPath" TEXT NOT NULL, "notes" TEXT, "status" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PhotoSession_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PhotoSession_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "Order" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "orderNumber" TEXT NOT NULL, "orderDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "deadline" DATETIME, "status" TEXT NOT NULL, "paymentStatus" TEXT NOT NULL, "totalPrice" INTEGER NOT NULL DEFAULT 0, "internalNotes" TEXT, "customerNotes" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "Order_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Order_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PhotoSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "OrderItem" ("id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "imageRef" TEXT NOT NULL, "productId" TEXT NOT NULL, "frameId" TEXT, "quantity" INTEGER NOT NULL, "size" TEXT NOT NULL, "variant" TEXT NOT NULL, "retouchType" TEXT NOT NULL, "retouchNotes" TEXT, "urgent" BOOLEAN NOT NULL DEFAULT false, "blackAndWhite" BOOLEAN NOT NULL DEFAULT false, "status" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "OrderItem_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "Frame" ("id") ON DELETE SET NULL ON UPDATE CASCADE);
CREATE TABLE "Product" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL, "price" INTEGER NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, CONSTRAINT "Product_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "Frame" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "name" TEXT NOT NULL, "size" TEXT NOT NULL, "color" TEXT NOT NULL, "price" INTEGER NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, CONSTRAINT "Frame_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "Retoucher" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "phone" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "notes" TEXT, CONSTRAINT "Retoucher_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "RetouchTask" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "orderItemId" TEXT NOT NULL, "assignedRetoucherId" TEXT, "retouchType" TEXT NOT NULL, "notes" TEXT, "deadline" DATETIME, "status" TEXT NOT NULL, "urgent" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RetouchTask_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "RetouchTask_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "RetouchTask_assignedRetoucherId_fkey" FOREIGN KEY ("assignedRetoucherId") REFERENCES "Retoucher" ("id") ON DELETE SET NULL ON UPDATE CASCADE);
CREATE TABLE "EmailTemplate" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true, CONSTRAINT "EmailTemplate_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "Activity" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "message" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Activity_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "BridgeLog" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "action" TEXT NOT NULL, "status" TEXT NOT NULL, "message" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "BridgeLog_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE TABLE "SubscriptionPlan" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "priceDkk" INTEGER NOT NULL, "description" TEXT NOT NULL, "featuresJson" TEXT NOT NULL, "orderLimit" INTEGER, "bridgeAutomation" BOOLEAN NOT NULL DEFAULT false, "userLimit" INTEGER NOT NULL, "sortOrder" INTEGER NOT NULL);
CREATE TABLE "StudioSubscription" ("id" TEXT NOT NULL PRIMARY KEY, "studioId" TEXT NOT NULL, "planId" TEXT NOT NULL, "status" TEXT NOT NULL, "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "StudioSubscription_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "StudioSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "Studio_slug_key" ON "Studio"("slug");
CREATE UNIQUE INDEX "StudioSettings_studioId_key" ON "StudioSettings"("studioId");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "RetouchTask_orderItemId_key" ON "RetouchTask"("orderItemId");
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");
CREATE UNIQUE INDEX "StudioSubscription_studioId_key" ON "StudioSubscription"("studioId");
`;

async function main() {
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  await fs.rm(dbPath, { force: true });

  const prisma = new PrismaClient();
  try {
    for (const statement of schemaSql.split(/;\s*\n/).map((part) => part.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(`${statement};`);
    }
    console.log(`SQLite schema initialized at ${dbPath}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
