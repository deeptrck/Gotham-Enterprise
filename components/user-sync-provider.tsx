"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

import { syncUserToDb } from "@/lib/api";

export default function UserSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isSignedIn, isLoaded } = useUser();

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

  return <>{children}</>;
}