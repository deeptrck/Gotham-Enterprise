import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDocClient, getDynamoTableName } from "@/lib/aws/dynamo";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : "";

    if (!apiKey) {
      return NextResponse.json(
        { error: "api_key is required" },
        { status: 400 }
      );
    }

    const tableName = getDynamoTableName();

    const existing = await dynamoDocClient.send(
      new GetCommand({
        TableName: tableName,
        Key: { api_key: apiKey },
      })
    );

    const item = existing.Item as Record<string, unknown> | undefined;
    if (!item) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (String(item.client_id) !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await dynamoDocClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { api_key: apiKey },
        UpdateExpression: "SET #s = :revoked",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":revoked": "revoked" },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
