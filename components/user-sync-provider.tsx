"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect, useRef } from "react";

import { syncUserToDb } from "@/lib/api";

export default function UserSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useUser();
  const hasSynced = useRef(false);

  useEffect(() => {
    if (isLoading || !user || hasSynced.current) return;

    const email = typeof user.email === "string" ? user.email.trim() : "";
    if (!email) return;

    hasSynced.current = true;
    const fullName = user.name?.trim() || email.split("@")[0] || "User";

    syncUserToDb({
      email,
      fullName,
      imageUrl: user.picture,
    }).catch(() => {
      hasSynced.current = false;
    });
  }, [isLoading, user]);

  return <>{children}</>;
}
