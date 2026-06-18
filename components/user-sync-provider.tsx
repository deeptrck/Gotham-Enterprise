"use client";
HEAD

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { useUser, useOrganizationList } from "@clerk/nextjs";
import { useEffect } from "react";
 d7ee7e0 (fix: clerk redirect urls and mongo uri)
import { syncUserToDb } from "@/lib/api";

export default function UserSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
 HEAD
  const { user, isSignedIn, isLoaded } = useUser();
  // Prevent syncing more than once per session
  const hasSynced = useRef(false);

  useEffect(() => {
    // Wait for Clerk to finish loading before attempting sync
    if (!isLoaded) return;
    if (!isSignedIn || !user) return;
    if (hasSynced.current) return;

  const { user, isSignedIn } = useUser();
  const { userMemberships, createOrganization, setActive } = useOrganizationList({
    userMemberships: true,
  });

  useEffect(() => {
    if (!isSignedIn || !user) return;
d7ee7e0 (fix: clerk redirect urls and mongo uri)

    const email = user.primaryEmailAddress?.emailAddress?.trim();
    if (!email) return;

 HEAD
    hasSynced.current = true;

 d7ee7e0 (fix: clerk redirect urls and mongo uri)
    const fullName = user.fullName?.trim() || email.split("@")[0] || "User";

    syncUserToDb({
      email,
      fullName,
      imageUrl: user.imageUrl,
HEAD
    }).catch(() => {
      // Reset so it can retry on next render if it failed
      hasSynced.current = false;
    });
  }, [isLoaded, isSignedIn, user]);

    }).catch(() => {});

    // Auto-create org if user has none
    if (userMemberships?.data?.length === 0) {
      const domain = email.split("@")[1]?.split(".")[0] || "my-org";
      const orgName = domain.charAt(0).toUpperCase() + domain.slice(1);

      createOrganization({ name: orgName }).then((org) => {
        setActive({ organization: org.id });
      }).catch(() => {});
    }
  }, [isSignedIn, user, userMemberships?.data?.length]);
 d7ee7e0 (fix: clerk redirect urls and mongo uri)

  return <>{children}</>;
}