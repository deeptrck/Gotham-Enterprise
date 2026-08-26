import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";

const PUBLIC_API_PATHS = new Set(["/api/health", "/api/paystack/webhook"]);
const ORG_CLAIM = "https://deeptrack.io/organization_id";

export async function middleware(request: NextRequest) {
  const authResponse = await auth0.middleware(request);
  if (!request.nextUrl.pathname.startsWith("/api/") || PUBLIC_API_PATHS.has(request.nextUrl.pathname)) return authResponse;
  const session = await auth0.getSession(request);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const claims = session.user as Record<string, unknown>;
  const organizationId = claims.org_id ?? claims.organization_id ?? claims[ORG_CLAIM];
  if (typeof organizationId !== "string" || !organizationId.trim()) return NextResponse.json({ error: "Organization context required" }, { status: 403 });
  return authResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
