import { auth0 } from "@/lib/auth0";
export { AUTH0_ROLE_CLAIM, getAuth0Roles, hasAnyRole, isGothamAdministrator, getOrganizationId, canAccessOrganization } from "@/lib/authClaims";
export type { GothamRole } from "@/lib/authClaims";

export async function auth() {
  const session = await auth0.getSession();
  return {
    userId: session?.user?.sub ?? null,
    user: session?.user ?? null,
    session,
  };
}

export async function currentUser() {
  const session = await auth0.getSession();
  const user = session?.user;
  if (!user) return null;

  // Keep the old server-side shape temporarily so admin routes can migrate
  // incrementally without changing their authorization behavior in one release.
  return {
    ...user,
    id: user.sub,
    fullName: user.name,
    imageUrl: user.picture,
    primaryEmailAddress: user.email
      ? { emailAddress: user.email }
      : undefined,
    emailAddresses: user.email
      ? [{ emailAddress: user.email }]
      : [],
  };
}
