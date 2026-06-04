/**
 * Next.js Middleware to enable Clerk authentication on server routes.
 *
 * This ensures server-side `auth()` can detect clerk middleware usage.
 * See: https://clerk.com/docs
 */
import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logUserAccess } from "@/lib/logUserAccess";
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

// Routes to skip for access logging (static assets, etc.)
const skipAccessLogging = createRouteMatcher([
  "/_next/static/:path*",
  "/_next/image/:path*",
  "/favicon.ico",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Log authenticated user access (page visits and API calls)
  if (userId && !skipAccessLogging(req)) {
    // Non-blocking async logging (fire and forget)
    // Temporarily disabled due to edge runtime mongoose issues
    /*
    try {
      await logUserAccess({
        clerkId: userId,
        accessType: req.nextUrl.pathname.startsWith("/api/")
          ? "api_call"
          : "page_visit",
        routePath: req.nextUrl.pathname,
        method: req.method,
        userAgent: req.headers.get("user-agent") || undefined,
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0] || undefined,
      });
    } catch (err) {
      console.error("Failed to log access:", err);
    }
    */
  }

  if (isBackOfficeRoute(req) || isAdminRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const emails = [
      ...(user.emailAddresses || []).map((e) => e.emailAddress?.toLowerCase()),
      user.primaryEmailAddress?.emailAddress?.toLowerCase(),
    ].filter((value): value is string => Boolean(value));

    if (!isEmailAllowlisted(emails)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
});

// Apply the middleware to API routes and all app pages (excluding next internals)
export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
