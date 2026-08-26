import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import ClientAdminClient from "./ClientAdminClient";

const ROLE_CLAIM = "https://deeptrack.io/roles";

function claimValues(value: unknown) {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  return typeof value === "string" ? [value] : [];
}

export default async function ClientAdminPage() {
  const session = await auth0.getSession();
  if (!session?.user) redirect("/auth/login?returnTo=/client-admin");

  const user = session.user as typeof session.user & Record<string, unknown>;
  const roles = claimValues(user[ROLE_CLAIM]).map((role) => role.toLowerCase());
  const canAdminister = roles.some((role) => ["founder", "owner", "admin", "client_admin", "investorrelations", "investor_relations"].includes(role));
  if (!canAdminister) redirect("/dashboard");

  return <ClientAdminClient user={{ name: user.name ?? user.email ?? "Administrator", email: user.email ?? "", roles }} />;
}
