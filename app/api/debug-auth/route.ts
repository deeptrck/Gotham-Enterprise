import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Collect every cookie name (not values, for safety) the server actually received
  const cookieNames = req.cookies.getAll().map((c) => c.name);

  // Collect every header Clerk's middleware would have injected
  const clerkHeaders: Record<string, string | null> = {
    "x-clerk-auth-status": req.headers.get("x-clerk-auth-status"),
    "x-clerk-auth-reason": req.headers.get("x-clerk-auth-reason"),
    "x-clerk-auth-message": req.headers.get("x-clerk-auth-message"),
    "x-clerk-auth-token": req.headers.get("x-clerk-auth-token") ? "present (hidden)" : null,
  };

  let authResult: { userId: string | null; error?: string } = { userId: null };
  try {
    const { userId } = await auth();
    authResult = { userId };
  } catch (e) {
    authResult = { userId: null, error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json({
    cookieNames,
    clerkHeaders,
    authResult,
    hasSessionCookie: cookieNames.some((n) => n === "__session" || n.startsWith("__session")),
    hasClientUat: cookieNames.includes("__client_uat"),
    hasDevBrowserJwt: cookieNames.includes("__clerk_db_jwt"),
  });
}