import { randomUUID } from "node:crypto";

import {
  createOrder,
  getOrderForJob,
  resetOrderForCheckout,
  setCheckoutSession,
} from "@/lib/order-repository";
import { getJobForOwner } from "@/lib/job-repository";
import { ORDER_STATUSES } from "@/lib/order-types";
import { getStripeClient } from "@/lib/stripe-client";
import { getStripeConfig } from "@/lib/stripe-config";
import { getSessionOwner } from "@/lib/session";

const ORDER_RETENTION_SECONDS = 30 * 24 * 60 * 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const owner = await getSessionOwner();
  const result = await getJobForOwner(jobId, owner);

  if (!result) {
    return Response.json({ message: "Job not found" }, { status: 404 });
  }

  if (
    result.job.status !== "completed" ||
    result.job.completedPhotos !== result.job.totalPhotos
  ) {
    return Response.json(
      { message: "The job is not ready for purchase" },
      { status: 409 },
    );
  }

  const stripe = getStripeClient();
  const stripeConfig = getStripeConfig();
  let order = await getOrderForJob(jobId);

  if (order?.status === ORDER_STATUSES.PAID) {
    return Response.json({ orderStatus: ORDER_STATUSES.PAID }, { status: 200 });
  }

  if (order?.status === ORDER_STATUSES.PENDING && order.checkoutUrl) {
    if (order.stripeCheckoutSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        order.stripeCheckoutSessionId,
      );

      if (existingSession.status === "open") {
        return Response.json({
          checkoutUrl: order.checkoutUrl,
          orderId: order.orderId,
          orderStatus: order.status,
        });
      }

      if (existingSession.status === "complete") {
        return Response.json(
          { message: "The payment is being confirmed" },
          { status: 409 },
        );
      }
    }

    await resetOrderForCheckout(
      jobId,
      Math.floor(Date.now() / 1000) + ORDER_RETENTION_SECONDS,
    );
    order = await getOrderForJob(jobId);
  } else if (
    order?.status === ORDER_STATUSES.EXPIRED ||
    order?.status === ORDER_STATUSES.FAILED
  ) {
    await resetOrderForCheckout(
      jobId,
      Math.floor(Date.now() / 1000) + ORDER_RETENTION_SECONDS,
    );
    order = await getOrderForJob(jobId);
  }

  if (!order) {
    const price = await stripe.prices.retrieve(stripeConfig.priceId);

    if (
      !price.active ||
      price.type !== "one_time" ||
      price.unit_amount === null
    ) {
      return Response.json(
        { message: "The Stripe price is not configured for one-time payment" },
        { status: 500 },
      );
    }

    order = await createOrder({
      amount: price.unit_amount,
      currency: price.currency,
      expiresAt: Math.floor(Date.now() / 1000) + ORDER_RETENTION_SECONDS,
      jobId,
      orderId: randomUUID(),
      ownerId: owner.ownerId,
      ownerType: owner.ownerType,
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    cancel_url: `${stripeConfig.appUrl}/?payment=cancelled&job_id=${encodeURIComponent(jobId)}`,
    client_reference_id: order.orderId,
    line_items: [{ price: stripeConfig.priceId, quantity: 1 }],
    metadata: {
      jobId,
      orderId: order.orderId,
    },
    mode: "payment",
    success_url: `${stripeConfig.appUrl}/?payment=success&job_id=${encodeURIComponent(jobId)}`,
  });

  if (!checkoutSession.url) {
    return Response.json(
      { message: "Stripe did not return a checkout URL" },
      { status: 502 },
    );
  }

  await setCheckoutSession(jobId, checkoutSession.id, checkoutSession.url);

  return Response.json({
    checkoutUrl: checkoutSession.url,
    orderId: order.orderId,
    orderStatus: ORDER_STATUSES.PENDING,
  });
}
