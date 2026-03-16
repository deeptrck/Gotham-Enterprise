/**
 * Next.js Middleware to enable Clerk authentication on server routes.
 *
 * This ensures server-side `auth()` can detect clerk middleware usage.
 * See: https://clerk.com/docs
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { logUserAccess } from "@/lib/logUserAccess";

const isAdminDashboardRoute = createRouteMatcher(["/admin/dashboard(.*)"]);
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
    logUserAccess({
      clerkId: userId,
      accessType: req.nextUrl.pathname.startsWith("/api/")
        ? "api_call"
        : "page_visit",
      routePath: req.nextUrl.pathname,
      method: req.method,
      userAgent: req.headers.get("user-agent") || undefined,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0] || undefined,
    }).catch((err) => console.error("Failed to log access:", err));
  }

  // Admin dashboard protection
  if (!isAdminDashboardRoute(req)) return;

  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

// Apply the middleware to API routes and all app pages (excluding next internals)
export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
