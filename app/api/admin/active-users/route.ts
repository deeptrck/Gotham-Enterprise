import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/lib/models/User";
import { UserAccess } from "@/lib/models/UserAccess";
import { isEmailAllowlisted } from "@/lib/adminAccess";
import * as Sentry from "@sentry/nextjs";

export interface ActiveUserInfo {
  email: string;
  clerkId: string;
  lastAccessedAt: string;
  accessCount: number;
  recentActivities: Array<{
    accessType: "page_visit" | "api_call";
    routePath: string;
    method?: string;
    lastAccessedAt: string;
  }>;
}

export interface ActiveUsersResponse {
  success: boolean;
  timeframe: string;
  totalActiveUsers: number;
  data: ActiveUserInfo[];
  generatedAt: string;
}

/**
 * GET /api/admin/active-users
 * Returns currently active users (default: last 24 hours)
 * Admin-only endpoint (requires admin email)
 *
 * Query params:
 * - hours: number of hours to look back (default: 24)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check admin access
    const user = await User.findOne({ clerkId: userId }).select("email").lean() as { email?: string } | null;
    if (!user?.email) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (!isEmailAllowlisted([user.email])) {
      return NextResponse.json(
        {
          error: "Access denied. Admin access required.",
        },
        { status: 403 }
      );
    }

    await connectToDatabase();

    // Get query parameters
    const url = new URL(req.url);
    const hoursParam = url.searchParams.get("hours");
    const hours = hoursParam ? parseInt(hoursParam, 10) : 24;

    if (hours < 1 || hours > 8760) {
      return NextResponse.json(
        { error: "Hours must be between 1 and 8760 (1 year)" },
        { status: 400 }
      );
    }

    // Calculate cutoff time
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Get all unique users active in the timeframe
    const activeUserAccessLogs = await UserAccess.aggregate([
      {
        $match: {
          lastAccessedAt: { $gte: cutoffTime },
        },
      },
      {
        $group: {
          _id: "$clerkId",
          email: { $first: "$email" },
          lastAccessedAt: { $max: "$lastAccessedAt" },
          activities: {
            $push: {
              accessType: "$accessType",
              routePath: "$routePath",
              method: "$method",
              lastAccessedAt: "$lastAccessedAt",
            },
          },
          accessCount: { $sum: 1 },
        },
      },
      {
        $sort: { lastAccessedAt: -1 },
      },
    ]);

    const formattedUsers: ActiveUserInfo[] = activeUserAccessLogs.map(
      (user: any) => ({
        email: user.email,
        clerkId: user._id,
        lastAccessedAt: user.lastAccessedAt.toISOString(),
        accessCount: user.accessCount,
        recentActivities: user.activities
          .sort(
            (a: any, b: any) =>
              new Date(b.lastAccessedAt).getTime() -
              new Date(a.lastAccessedAt).getTime()
          )
          .slice(0, 5) // Last 5 activities
          .map((act: any) => ({
            accessType: act.accessType,
            routePath: act.routePath,
            method: act.method || "N/A",
            lastAccessedAt: act.lastAccessedAt.toISOString(),
          })),
      })
    );

    const response: ActiveUsersResponse = {
      success: true,
      timeframe: `Last ${hours} hour${hours !== 1 ? "s" : ""}`,
      totalActiveUsers: formattedUsers.length,
      data: formattedUsers,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching active users:", error);
    Sentry.captureException(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
