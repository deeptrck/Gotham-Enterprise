/**
 * Next.js Middleware to enable Clerk authentication on server routes.
 *
 * This ensures server-side `auth()` can detect clerk middleware usage.
 * See: https://clerk.com/docs
 */
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminDashboardRoute = createRouteMatcher(["/admin/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isAdminDashboardRoute(req)) return;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

// Apply the middleware to API routes and all app pages (excluding next internals)
export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};
