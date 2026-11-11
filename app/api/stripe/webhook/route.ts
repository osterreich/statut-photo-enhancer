import Stripe from "stripe";

import {
  markOrderExpired,
  markOrderFailed,
  markOrderPaid,
} from "@/lib/order-repository";
import { getStripeClient } from "@/lib/stripe-client";
import { getStripeConfig } from "@/lib/stripe-config";

function getOrderMetadata(session: Stripe.Checkout.Session): {
  jobId: string;
  orderId: string;
} | null {
  const jobId = session.metadata?.jobId;
  const orderId = session.metadata?.orderId;

  if (!jobId || !orderId) {
    return null;
  }

  return { jobId, orderId };
}

function getPaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null,
): string | undefined {
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
}

async function handlePaidSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const metadata = getOrderMetadata(session);

  if (!metadata) {
    console.error("Stripe session has no order metadata", session.id);
    return;
  }

  await markOrderPaid({
    customerEmail: session.customer_details?.email ?? undefined,
    jobId: metadata.jobId,
    orderId: metadata.orderId,
    stripePaymentIntentId: getPaymentIntentId(session.payment_intent),
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { message: "Missing Stripe signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = getStripeClient().webhooks.constructEvent(
      body,
      signature,
      getStripeConfig().webhookSecret,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return Response.json({ message: "Invalid Stripe webhook" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          await handlePaidSession(session);
        }
        break;
      }
      case "checkout.session.async_payment_succeeded":
        await handlePaidSession(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.async_payment_failed": {
        const metadata = getOrderMetadata(
          event.data.object as Stripe.Checkout.Session,
        );

        if (metadata) {
          await markOrderFailed(metadata.jobId, metadata.orderId);
        }
        break;
      }
      case "checkout.session.expired": {
        const metadata = getOrderMetadata(
          event.data.object as Stripe.Checkout.Session,
        );

        if (metadata) {
          await markOrderExpired(metadata.jobId, metadata.orderId);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return Response.json(
      { message: "Webhook processing failed" },
      { status: 500 },
    );
  }

  return Response.json({ received: true });
}
