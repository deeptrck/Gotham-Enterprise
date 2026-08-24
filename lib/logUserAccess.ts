import { connectToDatabase } from "@/lib/db";
import { UserAccess } from "@/lib/models/UserAccess";
import { User } from "@/lib/models/User";

export type AccessLogInput = {
  auth0Sub: string;
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

    const { auth0Sub, accessType, routePath, method, userAgent, ipAddress } = input;

    // Get user email from User model
    const user = (await User.findOne({ auth0Sub }).select("email").lean()) as { email?: string } | null;
    if (!user?.email) {
      console.warn(`User not found for auth0Sub: ${auth0Sub}`);
      return;
    }

    // Upsert: update lastAccessedAt if exists, create if new
    await UserAccess.findOneAndUpdate(
      { auth0Sub, accessType, routePath },
      {
        $set: {
          auth0Sub,
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
