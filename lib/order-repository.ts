import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { getDynamoDbConfig } from "@/lib/dynamodb-config";
import {
  ORDER_STATUSES,
  type OrderRecord,
  type OrderStatus,
} from "@/lib/order-types";
import { getDynamoDbDocumentClient } from "@/lib/dynamodb-client";

type OrderItem = OrderRecord & {
  PK: string;
  SK: "ORDER";
  entityType: "order";
};

type CreateOrderInput = Omit<
  OrderRecord,
  | "status"
  | "createdAt"
  | "updatedAt"
  | "stripeCheckoutSessionId"
  | "checkoutUrl"
  | "stripePaymentIntentId"
  | "customerEmail"
  | "paidAt"
>;

function orderKey(jobId: string) {
  return {
    PK: `JOB#${jobId}`,
    SK: "ORDER" as const,
  };
}

function now(): string {
  return new Date().toISOString();
}

function getTableName(): string {
  return getDynamoDbConfig().tableName;
}

function toOrderRecord(item: OrderItem): OrderRecord {
  return Object.fromEntries(
    Object.entries(item).filter(
      ([key]) => key !== "PK" && key !== "SK" && key !== "entityType",
    ),
  ) as OrderRecord;
}

export async function getOrderForJob(
  jobId: string,
): Promise<OrderRecord | null> {
  const result = await getDynamoDbDocumentClient().send(
    new GetCommand({
      ConsistentRead: true,
      Key: orderKey(jobId),
      TableName: getTableName(),
    }),
  );

  if (!result.Item || result.Item.entityType !== "order") {
    return null;
  }

  return toOrderRecord(result.Item as OrderItem);
}

export async function createOrder(input: CreateOrderInput): Promise<OrderRecord> {
  const timestamp = now();
  const item: OrderItem = {
    ...orderKey(input.jobId),
    ...input,
    createdAt: timestamp,
    entityType: "order",
    status: ORDER_STATUSES.PENDING,
    updatedAt: timestamp,
  };

  await getDynamoDbDocumentClient().send(
    new PutCommand({
      ConditionExpression: "attribute_not_exists(PK)",
      Item: item,
      TableName: getTableName(),
    }),
  );

  return toOrderRecord(item);
}

export async function resetOrderForCheckout(
  jobId: string,
  expiresAt: number,
): Promise<void> {
  await getDynamoDbDocumentClient().send(
    new UpdateCommand({
      ConditionExpression: "#status = :failed OR #status = :expired",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":expired": ORDER_STATUSES.EXPIRED,
        ":failed": ORDER_STATUSES.FAILED,
        ":pending": ORDER_STATUSES.PENDING,
        ":timestamp": now(),
        ":expiresAt": expiresAt,
      },
      Key: orderKey(jobId),
      TableName: getTableName(),
      UpdateExpression:
        "SET #status = :pending, expiresAt = :expiresAt, updatedAt = :timestamp REMOVE stripeCheckoutSessionId, checkoutUrl, stripePaymentIntentId, customerEmail, paidAt",
    }),
  );
}

export async function setCheckoutSession(
  jobId: string,
  stripeCheckoutSessionId: string,
  checkoutUrl: string,
): Promise<void> {
  await getDynamoDbDocumentClient().send(
    new UpdateCommand({
      ConditionExpression: "#status = :pending",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":pending": ORDER_STATUSES.PENDING,
        ":sessionId": stripeCheckoutSessionId,
        ":timestamp": now(),
        ":url": checkoutUrl,
      },
      Key: orderKey(jobId),
      TableName: getTableName(),
      UpdateExpression:
        "SET stripeCheckoutSessionId = :sessionId, checkoutUrl = :url, updatedAt = :timestamp",
    }),
  );
}

async function updateOrderStatus(
  jobId: string,
  orderId: string,
  status: OrderStatus,
  fields: Record<string, unknown> = {},
): Promise<void> {
  const order = await getOrderForJob(jobId);

  if (!order || order.orderId !== orderId || order.status === ORDER_STATUSES.PAID) {
    return;
  }

  const expressionNames: Record<string, string> = { "#status": "status" };
  const expressionValues: Record<string, unknown> = {
    ":expectedStatus": order.status,
    ":status": status,
    ":timestamp": now(),
  };
  const assignments = [
    "#status = :status",
    "updatedAt = :timestamp",
  ];

  for (const [field, value] of Object.entries(fields)) {
    const name = `#${field}`;
    const valueName = `:${field}`;
    expressionNames[name] = field;
    expressionValues[valueName] = value;
    assignments.push(`${name} = ${valueName}`);
  }

  try {
    await getDynamoDbDocumentClient().send(
      new UpdateCommand({
        ConditionExpression: "#status = :expectedStatus",
        ExpressionAttributeNames: expressionNames,
        ExpressionAttributeValues: expressionValues,
        Key: orderKey(jobId),
        TableName: getTableName(),
        UpdateExpression: `SET ${assignments.join(", ")}`,
      }),
    );
  } catch (error) {
    if (!(error instanceof ConditionalCheckFailedException)) {
      throw error;
    }
  }
}

export async function markOrderPaid(input: {
  jobId: string;
  orderId: string;
  stripePaymentIntentId?: string;
  customerEmail?: string;
}): Promise<void> {
  const fields: Record<string, unknown> = { paidAt: now() };

  if (input.customerEmail) {
    fields.customerEmail = input.customerEmail;
  }

  if (input.stripePaymentIntentId) {
    fields.stripePaymentIntentId = input.stripePaymentIntentId;
  }

  await updateOrderStatus(
    input.jobId,
    input.orderId,
    ORDER_STATUSES.PAID,
    fields,
  );
}

export async function markOrderFailed(
  jobId: string,
  orderId: string,
): Promise<void> {
  await updateOrderStatus(jobId, orderId, ORDER_STATUSES.FAILED);
}

export async function markOrderExpired(
  jobId: string,
  orderId: string,
): Promise<void> {
  await updateOrderStatus(jobId, orderId, ORDER_STATUSES.EXPIRED);
}
