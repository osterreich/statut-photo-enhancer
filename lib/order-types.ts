import type { JobOwnerType } from "@/lib/job-types";

export const ORDER_STATUSES = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
} as const;

export type OrderStatus = (typeof ORDER_STATUSES)[keyof typeof ORDER_STATUSES];

export type OrderRecord = {
  orderId: string;
  jobId: string;
  ownerId: string;
  ownerType: JobOwnerType;
  status: OrderStatus;
  amount: number;
  currency: string;
  stripeCheckoutSessionId?: string;
  checkoutUrl?: string;
  stripePaymentIntentId?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  expiresAt: number;
};
