"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { syncUserToDb } from "@/lib/api";

export default function UserSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isSignedIn, isLoaded } = useUser();
  const { userMemberships, createOrganization, setActive } =
    useOrganizationList({
      userMemberships: true,
    });

  // Prevent syncing more than once per session
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) return;
    if (hasSynced.current) return;

    const email = user.primaryEmailAddress?.emailAddress?.trim();
    if (!email) return;

    hasSynced.current = true;

    const fullName = user.fullName?.trim() || email.split("@")[0] || "User";

    syncUserToDb({
      email,
      fullName,
      imageUrl: user.imageUrl,
    }).catch(() => {
      // Reset so it can retry on next render if it failed
      hasSynced.current = false;
    });
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    const email = user.primaryEmailAddress?.emailAddress?.trim();
    if (!email) return;

    // Auto-create org if user has none
    if (userMemberships?.data?.length === 0) {
      const domain = email.split("@")[1]?.split(".")[0] || "my-org";
      const orgName = domain.charAt(0).toUpperCase() + domain.slice(1);

      // Avoid calling potentially-undefined functions during initial Clerk load
      if (!createOrganization || !setActive) return;

      void createOrganization({ name: orgName })
        .then((org) => {
          setActive({ organization: org.id });
        })
        .catch(() => {});
    }
  }, [isSignedIn, user, userMemberships?.data?.length, createOrganization, setActive]);


  return <>{children}</>;
}

