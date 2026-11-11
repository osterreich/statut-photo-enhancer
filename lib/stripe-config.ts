type StripeConfig = {
  appUrl: string;
  priceId: string;
  secretKey: string;
  webhookSecret: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getStripeConfig(): StripeConfig {
  return {
    appUrl: withoutTrailingSlash(requiredEnv("APP_URL")),
    priceId: requiredEnv("STRIPE_PRICE_ID"),
    secretKey: requiredEnv("STRIPE_SECRET_KEY"),
    webhookSecret: requiredEnv("STRIPE_WEBHOOK_SECRET"),
  };
}
