"use client";
import { useUser, useOrganizationList } from "@clerk/nextjs";
import { useEffect } from "react";
import { syncUserToDb } from "@/lib/api";

export default function UserSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isSignedIn } = useUser();
  const { userMemberships, createOrganization, setActive } = useOrganizationList({
    userMemberships: true,
  });

  useEffect(() => {
    if (!isSignedIn || !user) return;

    const email = user.primaryEmailAddress?.emailAddress?.trim();
    if (!email) return;

    const fullName = user.fullName?.trim() || email.split("@")[0] || "User";

    syncUserToDb({
      email,
      fullName,
      imageUrl: user.imageUrl,
    }).catch(() => {});

    if (userMemberships?.data?.length === 0) {
      const domain = email.split("@")[1]?.split(".")[0] || "my-org";
      const orgName = domain.charAt(0).toUpperCase() + domain.slice(1);

      createOrganization({ name: orgName }).then((org) => {
        setActive({ organization: org.id });
      }).catch(() => {});
    }
  }, [isSignedIn, user, userMemberships?.data?.length]);

  return <>{children}</>;
}