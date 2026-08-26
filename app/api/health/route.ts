import { NextResponse } from "next/server";
import { isGothamModelConfigured } from "@/lib/gothamModel";

export const dynamic = "force-dynamic";

export async function GET() {
  const modelConfigured = isGothamModelConfigured();
  const databaseConfigured = Boolean(process.env.MONGODB_URI || process.env.DATABASE_URL);

  return NextResponse.json(
    {
      status: modelConfigured && databaseConfigured ? "ok" : "degraded",
      service: "gotham-api",
      integrations: {
        proprietaryModel: modelConfigured ? "configured" : "not_configured",
        database: databaseConfigured ? "configured" : "not_configured",
      },
      timestamp: new Date().toISOString(),
    },
    { status: modelConfigured && databaseConfigured ? 200 : 503 },
  );
}
