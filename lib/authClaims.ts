export const AUTH0_ROLE_CLAIM = "https://deeptrack.io/roles";
export type GothamRole = "founder" | "platform_admin" | "admin" | "client_admin" | "analyst" | "viewer";

export function getAuth0Roles(user: unknown): string[] {
  if (!user || typeof user !== "object") return [];
  const claims = user as Record<string, unknown>;
  const raw = claims[AUTH0_ROLE_CLAIM] ?? claims.roles;
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return values.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
}

export function hasAnyRole(user: unknown, allowedRoles: readonly string[]): boolean {
  const roles = new Set(getAuth0Roles(user));
  return allowedRoles.some((role) => roles.has(role.toLowerCase()));
}

export function isGothamAdministrator(user: unknown): boolean {
  return hasAnyRole(user, ["founder", "platform_admin", "admin", "client_admin"]);
}

export function getOrganizationId(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const claims = user as Record<string, unknown>;
  const value = claims.org_id ?? claims.organization_id ?? claims["https://deeptrack.io/organization_id"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function canAccessOrganization(user: unknown, organizationId: string): boolean {
  const claimed = getOrganizationId(user);
  return Boolean(claimed && organizationId.trim() && claimed === organizationId.trim());
}
