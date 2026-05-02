"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { syncUserToDb } from "@/lib/api";

export default function UserSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isSignedIn } = useUser();

  useEffect(() => {
    if (isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress?.trim();
      if (!email) return;

      const fullName = user.fullName?.trim() || email.split("@")[0] || "User";

      syncUserToDb({
        email,
        fullName,
        imageUrl: user.imageUrl,
      }).catch((error) => {
        // Silently handle sync errors - user will be synced on next visit
        // Don't log to console as error - this is expected during initial auth
      });
    }
  }, [isSignedIn, user]);

  return <>{children}</>;
}
