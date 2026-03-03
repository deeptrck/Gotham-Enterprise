import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./AdminDashboardClient";
import { getAdminEmailAllowlist, isEmailAllowlisted } from "@/lib/adminAccess";

export default async function AdminDashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }

  const allowlist = getAdminEmailAllowlist();

  if (allowlist.length === 0) {
    redirect("/");
  }

  const user = await currentUser();
  const emails = (user?.emailAddresses || [])
    .map((entry) => entry.emailAddress?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));

  const allowed = isEmailAllowlisted(emails, allowlist);
  if (!allowed) {
    redirect("/");
  }

  return <AdminDashboardClient />;
}
