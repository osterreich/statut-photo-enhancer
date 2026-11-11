type DynamoDbConfig = {
  region: string;
  tableName: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getDynamoDbConfig(): DynamoDbConfig {
  const region =
    process.env.DYNAMODB_REGION?.trim() ||
    process.env.S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim();

  if (!region) {
    throw new Error(
      "Missing required environment variable: DYNAMODB_REGION or S3_REGION",
    );
  }

  return {
    region,
    tableName: getRequiredEnv("DYNAMODB_TABLE_NAME"),
  };
}
