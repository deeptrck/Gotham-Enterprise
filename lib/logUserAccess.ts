import { connectToDatabase } from "@/lib/db";
import { UserAccess } from "@/lib/models/UserAccess";
import { User } from "@/lib/models/User";

export type AccessLogInput = {
  clerkId: string;
  accessType: "page_visit" | "api_call";
  routePath: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
};

/**
 * Log user access to the database
 * Creates or updates user access record with current timestamp
 */
export async function logUserAccess(input: AccessLogInput): Promise<void> {
  try {
    await connectToDatabase();

    const { clerkId, accessType, routePath, method, userAgent, ipAddress } = input;

    // Get user email from User model
    const user = (await User.findOne({ clerkId }).select("email").lean()) as { email?: string } | null;
    if (!user?.email) {
      console.warn(`User not found for clerkId: ${clerkId}`);
      return;
    }

    // Upsert: update lastAccessedAt if exists, create if new
    await UserAccess.findOneAndUpdate(
      { clerkId, accessType, routePath },
      {
        $set: {
          clerkId,
          email: user.email,
          accessType,
          routePath,
          method,
          userAgent,
          ipAddress,
          lastAccessedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Error logging user access:", error);
    // Don't throw - access logging should never break the app
  }
}
