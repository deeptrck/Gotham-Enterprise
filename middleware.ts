/**
 * Clerk authentication middleware.
 *
 * IMPORTANT: clerkMiddleware() MUST run on every route (including API routes)
 * for server-side auth() calls to work. Without this, auth() returns null userId
 * on all API routes, causing every protected endpoint to return 401.
 *
 * The `protect()` call inside the handler is what makes Clerk actually validate
 * the session token and populate auth() in downstream route handlers.
 */
import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isEmailAllowlisted } from "@/lib/adminAccess";

const isAdminRoute = createRouteMatcher([
  "/admin",
  "/admin/(.*)",
  "/api/admin",
  "/api/admin/(.*)",
]);

const isBackOfficeRoute = createRouteMatcher([
  "/backoffice",
  "/backoffice/(.*)",
]);

// All routes that require the user to be signed in
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/history(.*)",
  "/results(.*)",
  "/report-bug(.*)",
  "/console(.*)",
  "/api/scans(.*)",
  "/api/results(.*)",
  "/api/users(.*)",
  "/api/paystack(.*)",
  "/api/generate-key(.*)",
  "/api/revoke-key(.*)",
  "/api/usage(.*)",
  "/api/bugs(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // --- Protect standard authenticated routes ---
  // For page routes: redirect to login. For API routes: return 401.
  if (isProtectedRoute(req) && !userId) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect_url", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // --- Protect admin & backoffice routes (require email allowlist) ---
  if (isBackOfficeRoute(req) || isAdminRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const emails = [
        ...(user.emailAddresses || []).map((e) => e.emailAddress?.toLowerCase()),
        user.primaryEmailAddress?.emailAddress?.toLowerCase(),
      ].filter((value): value is string => Boolean(value));

      if (!isEmailAllowlisted(emails)) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    } catch (err) {
      console.error("Admin access check failed:", err);
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};