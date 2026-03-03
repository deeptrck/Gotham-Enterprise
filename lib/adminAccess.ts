export function getAdminEmailAllowlist(): string[] {
  const configured = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length === 0 && process.env.NODE_ENV !== "production") {
    return ["*"];
  }

  return configured;
}

export function isEmailAllowlisted(
  userEmails: string[],
  allowlist: string[] = getAdminEmailAllowlist()
): boolean {
  if (allowlist.length === 0) return false;
  if (allowlist.includes("*")) return true;
  return userEmails.some((email) => allowlist.includes(email.toLowerCase()));
}
