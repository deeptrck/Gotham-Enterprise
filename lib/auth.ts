import { auth as clerkAuth } from "@clerk/nextjs/server";

/**
 * Wrapped Clerk auth() that treats "pending" sessions as fully signed-in.
 *
 * Background: Clerk sessions can enter a "pending" status when Organizations
 * are enabled on the Clerk instance and the user hasn't selected/created one
 * yet. By default, Clerk's auth() treats "pending" as signed-out (userId:
 * null) everywhere, even though the user has a perfectly valid, verified
 * session. This app doesn't use Clerk Organizations, so we never want a
 * pending org-selection task to lock users out of API routes.
 *
 * Use this `auth()` everywhere instead of importing directly from
 * "@clerk/nextjs/server" in API routes / server components.
 */
export async function auth() {
  return clerkAuth({ treatPendingAsSignedOut: false });
}
