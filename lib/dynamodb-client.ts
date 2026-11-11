import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { getDynamoDbConfig } from "@/lib/dynamodb-config";

const globalForDynamoDb = globalThis as typeof globalThis & {
  dynamoDbDocumentClient?: DynamoDBDocumentClient;
  dynamoDbRegion?: string;
};

export function getDynamoDbDocumentClient(): DynamoDBDocumentClient {
  const { region } = getDynamoDbConfig();

  if (
    !globalForDynamoDb.dynamoDbDocumentClient ||
    globalForDynamoDb.dynamoDbRegion !== region
  ) {
    globalForDynamoDb.dynamoDbDocumentClient = DynamoDBDocumentClient.from(
      new DynamoDBClient({ region }),
      {
        marshallOptions: {
          removeUndefinedValues: true,
        },
      },
    );
    globalForDynamoDb.dynamoDbRegion = region;
  }

  return globalForDynamoDb.dynamoDbDocumentClient;
}
