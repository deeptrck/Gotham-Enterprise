import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDocClient, getDynamoTableName } from "@/lib/aws/dynamo";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const clientId = url.searchParams.get("clientId") || userId;
    const tableName = getDynamoTableName();

    const result = await dynamoDocClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: "client_id-index",
        KeyConditionExpression: "client_id = :cid",
        ExpressionAttributeValues: {
          ":cid": clientId,
        },
      })
    );

    const keys = (result.Items as Array<Record<string, unknown>> | undefined) ?? [];
    const totalScans = keys.reduce(
      (sum, key) => sum + Number(key.scans_used ?? 0),
      0
    );

    return NextResponse.json({
      keys: keys.map((key) => ({
        api_key_preview:
          typeof key.api_key === "string"
            ? key.api_key.slice(0, 12) + "..."
            : null,
        scans_used: Number(key.scans_used ?? 0),
        status: key.status ?? "unknown",
        created_at: key.created_at ?? null,
        plan: key.plan ?? "payg",
      })),
      total_scans: totalScans,
    });
  } catch (error) {
    console.error("Error fetching usage data:", error);
    return NextResponse.json(
      { error: "Failed to fetch usage stats" },
      { status: 500 }
    );
  }
}
