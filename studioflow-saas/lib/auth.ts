import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const USER_COOKIE = "studioflow_user";
export const STUDIO_COOKIE = "studioflow_studio";

const studioInclude = {
  settings: true,
  subscription: { include: { plan: true } }
};

const membershipInclude = {
  role: {
    include: {
      rolePermissions: { include: { permission: true } }
    }
  },
  studio: {
    include: studioInclude
  }
};

export async function getLoginOptions() {
  return prisma.user.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        where: { active: true },
        include: membershipInclude,
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

export async function getOptionalAuthContext() {
  const cookieStore = await cookies();
  const userId = cookieStore.get(USER_COOKIE)?.value;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        where: { active: true },
        include: membershipInclude,
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!user || user.memberships.length === 0) return null;

  const requestedStudioId = cookieStore.get(STUDIO_COOKIE)?.value;
  const activeMembership =
    user.memberships.find((membership) => membership.studioId === requestedStudioId) ?? user.memberships[0];

  return {
    user,
    memberships: user.memberships,
    membership: activeMembership,
    studio: activeMembership.studio,
    role: activeMembership.role
  };
}

export async function requireAuthContext() {
  const context = await getOptionalAuthContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireCurrentUser() {
  const context = await requireAuthContext();
  return context.user;
}

export async function requireActiveStudio() {
  const context = await requireAuthContext();
  return context.studio;
}

export async function requireStudioMembership(studioId: string) {
  const context = await requireAuthContext();
  const membership = context.memberships.find((item) => item.studioId === studioId);
  if (!membership) notFound();
  return { ...context, membership, studio: membership.studio, role: membership.role };
}

export function permissionKeys(role: Awaited<ReturnType<typeof requireAuthContext>>["role"]) {
  return role.rolePermissions.map((rolePermission) => rolePermission.permission.key);
}

export function founderAdminEmails() {
  return (process.env.STUDIOFLOW_ADMIN_EMAILS ?? "daniel@studioflow.test")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isFounderAdminEmail(email: string) {
  return founderAdminEmails().includes(email.toLowerCase());
}

export async function requireFounderAdmin() {
  const context = await requireAuthContext();
  if (!isFounderAdminEmail(context.user.email)) notFound();
  return context;
}

export async function requireRole(required: string | string[]) {
  const context = await requireAuthContext();
  const requiredList = Array.isArray(required) ? required : [required];
  const rolePermissions = permissionKeys(context.role);
  const allowed = requiredList.some((item) => item === context.role.name || rolePermissions.includes(item));

  if (!allowed) notFound();
  return context;
}

export async function requireStudioRecord<T>(loadRecord: (studioId: string) => Promise<T | null>) {
  const context = await requireAuthContext();
  const record = await loadRecord(context.studio.id);

  if (!record) notFound();
  return { ...context, record };
}

export async function createAuditLog({
  studioId,
  userId,
  action,
  entityType,
  entityId,
  metadata
}: {
  studioId?: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  let resolvedStudioId = studioId;
  let resolvedUserId = userId;

  if (!resolvedStudioId || typeof resolvedUserId === "undefined") {
    const context = await getOptionalAuthContext();
    resolvedStudioId ??= context?.studio.id;
    resolvedUserId = typeof resolvedUserId === "undefined" ? (context?.user.id ?? null) : resolvedUserId;
  }

  if (!resolvedStudioId) return null;

  return prisma.auditLog.create({
    data: {
      studioId: resolvedStudioId,
      userId: resolvedUserId ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      metadataJson: metadata ? JSON.stringify(metadata) : null
    }
  });
}
