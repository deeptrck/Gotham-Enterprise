import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@/lib/auth";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDocClient, getDynamoTableName } from "@/lib/aws/dynamo";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await currentUser();
    const clientName =
      user?.fullName ||
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      "unknown";

    const apiKey = "dt_live_" + crypto.randomBytes(24).toString("hex");
    const tableName = getDynamoTableName();

    await dynamoDocClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          api_key: apiKey,
          client_id: userId,
          client_name: clientName,
          created_at: new Date().toISOString(),
          status: "active",
          scans_used: 0,
          plan: "payg",
        },
      })
    );

    return NextResponse.json(
      { api_key: apiKey, created_at: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error generating API key:", error);
    return NextResponse.json(
      { error: "Failed to generate API key" },
      { status: 500 }
    );
  }
}
