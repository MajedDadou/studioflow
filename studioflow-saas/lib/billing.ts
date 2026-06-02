import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const LOCAL_BILLING_PROVIDER = "local-test";
export const FUTURE_PAYMENT_PROVIDERS = ["Stripe", "Paddle"] as const;

export function subscriptionStatusForPlan(plan: SubscriptionPlan) {
  return plan.name === "Free Trial" ? "Trialing" : "Active";
}

export function nextMonthlyRenewal(from = new Date()) {
  const date = new Date(from);
  date.setMonth(date.getMonth() + 1);
  return date;
}

export function trialEndsAt(from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + 14);
  return date;
}

export async function getPlanUsage(studioId: string, planOverride?: SubscriptionPlan) {
  const [subscription, activeUsers, orderCount] = await Promise.all([
    prisma.studioSubscription.findUnique({
      where: { studioId },
      include: { plan: true }
    }),
    prisma.studioMember.count({
      where: { studioId, active: true }
    }),
    prisma.order.count({
      where: { studioId }
    })
  ]);
  const plan = planOverride ?? subscription?.plan ?? null;
  const blockers: string[] = [];

  if (!plan) {
    blockers.push("No subscription plan is configured for this studio.");
  } else {
    if (activeUsers > plan.userLimit) {
      blockers.push(`This studio has ${activeUsers} active user(s), but ${plan.name} allows ${plan.userLimit}.`);
    }
    if (typeof plan.orderLimit === "number" && orderCount > plan.orderLimit) {
      blockers.push(`This studio has ${orderCount} order(s), but ${plan.name} allows ${plan.orderLimit}.`);
    }
  }

  return {
    subscription,
    plan,
    activeUsers,
    orderCount,
    userLimit: plan?.userLimit ?? 0,
    orderLimit: plan?.orderLimit ?? null,
    bridgeAutomationAvailable: Boolean(plan?.bridgeAutomation),
    blockers,
    orderLimitReached: typeof plan?.orderLimit === "number" ? orderCount >= plan.orderLimit : false,
    userLimitExceeded: plan ? activeUsers > plan.userLimit : true
  };
}

export async function assertCanCreateOrder(studioId: string) {
  const usage = await getPlanUsage(studioId);
  if (!usage.plan) {
    throw new Error("A subscription plan is required before creating orders.");
  }
  if (typeof usage.orderLimit === "number" && usage.orderCount >= usage.orderLimit) {
    throw new Error(`${usage.plan.name} allows ${usage.orderLimit} order(s). Upgrade the plan to create more orders.`);
  }
}

export async function assertBridgeAutomationAvailable(studioId: string) {
  const usage = await getPlanUsage(studioId);
  if (!usage.plan) {
    throw new Error("A subscription plan is required before using bridge automation.");
  }
  if (!usage.bridgeAutomationAvailable) {
    throw new Error(`${usage.plan.name} does not include bridge automation. Dry-run previews are still available.`);
  }
}
