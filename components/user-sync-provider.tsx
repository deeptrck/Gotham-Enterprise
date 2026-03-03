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
        console.error("Failed to sync user:", error);
      });
    }
  }, [isSignedIn, user]);

  return <>{children}</>;
}
