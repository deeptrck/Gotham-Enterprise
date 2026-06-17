import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-1";
const tableName = process.env.DYNAMODB_TABLE;

const dynamoConfig: DynamoDBClientConfig = { region };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  dynamoConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const dynamoClient = new DynamoDBClient(dynamoConfig);
export const dynamoDocClient = DynamoDBDocumentClient.from(dynamoClient);

export function getDynamoTableName(): string {
  if (!tableName) {
    throw new Error(
      "Missing DYNAMODB_TABLE environment variable. Add it to .env.local."
    );
  }

  return tableName;
}
