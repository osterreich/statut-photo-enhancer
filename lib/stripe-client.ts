import Stripe from "stripe";

import { getStripeConfig } from "@/lib/stripe-config";

let stripeClient: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeConfig().secretKey);
  }

  return stripeClient;
}
