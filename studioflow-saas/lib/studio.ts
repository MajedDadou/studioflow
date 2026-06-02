import { requireActiveStudio, requireAuthContext } from "@/lib/auth";

export {
  STUDIO_COOKIE,
  USER_COOKIE,
  createAuditLog,
  founderAdminEmails,
  isFounderAdminEmail,
  requireActiveStudio,
  requireCurrentUser,
  requireFounderAdmin,
  requireRole,
  requireStudioMembership,
  requireStudioRecord
} from "@/lib/auth";

export async function getStudios() {
  const context = await requireAuthContext();
  return context.memberships.map((membership) => membership.studio);
}

export async function getActiveStudio() {
  return requireActiveStudio();
}

export async function getActiveStudioContext() {
  return requireAuthContext();
}
