# Statut Photo Enhancer

Next.js application with an initial image-upload flow. The current version accepts JPEG, PNG and WebP files and stores them in a private Amazon S3 bucket. Image enhancement will be added later.

## Local development

1. Copy `.env.example` to `.env.local` and set the S3 bucket, region, and DynamoDB table name.
2. Make sure the AWS SDK can resolve credentials locally through the AWS CLI profile, IAM Identity Center, or environment variables.
3. Start the app:

```bash
npm run dev
```

Open http://localhost:3000.

`POST /api/jobs` creates a job and short-lived presigned S3 upload policies.
The browser sends image bodies directly to S3, so AWS credentials and large
file bodies are never sent through Next.js or Amplify.

When a job is completed, the jobs list shows a `Download for $5` button. The
button creates a Stripe-hosted Checkout Session; the application does not
render or handle card details itself. The server keeps the Stripe Price ID and
amount, so the browser cannot change the price.

The Stripe webhook endpoint is `POST /api/stripe/webhook`. Configure it to
listen for `checkout.session.completed`,
`checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `checkout.session.expired`.
Only a verified webhook changes an order to `paid`.

## DynamoDB jobs table

The job state is stored in a single-table DynamoDB design. Job records use
`PK=JOB#{jobId}, SK=JOB`; photo records use the same partition key and
`SK=PHOTO#{photoId}`. The table definition is in
`infrastructure/dynamodb-jobs-table.yaml`.

The `OwnerIndex` GSI uses `GSI1PK` and `GSI1SK` so the app can list jobs for
the current anonymous session without scanning the table.

Set `DYNAMODB_TABLE_NAME` to the deployed table name. `DYNAMODB_REGION` is
optional and falls back to `S3_REGION`.

The app runtime role needs `dynamodb:PutItem`, `dynamodb:GetItem`,
`dynamodb:Query`, and `dynamodb:UpdateItem` on the table and its
`OwnerIndex` index.

For anonymous users, jobs are associated with a hashed session identifier.
The raw session identifier is stored only in an `HttpOnly` cookie named
`photo_session`; it is never sent to the client application or stored in
DynamoDB.

## Orders and Stripe Checkout

Orders use the existing DynamoDB table and do not require a new index:
`PK=JOB#{jobId}, SK=ORDER`. Each job has at most one order. The order stores
the Stripe Checkout Session ID, amount, currency, payment status, and customer
email received from Stripe.

Create a one-time `$5` Price in Stripe Dashboard and put its ID into
`STRIPE_PRICE_ID`. For local webhook testing, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_...` value to `STRIPE_WEBHOOK_SECRET`. In production,
create a Dashboard webhook endpoint at
`https://YOUR_DOMAIN/api/stripe/webhook` and use its endpoint secret.

## AWS setup

The S3 bucket should remain private. Give the local AWS identity and the Amplify SSR Compute role only the permissions needed for the upload prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME/uploads/*",
        "arn:aws:s3:::YOUR_BUCKET_NAME/processed/*"
      ]
    }
  ]
}
```

For Amplify, add the variables from `.env.example` in the app environment settings. `amplify.yml` writes these values to `.env.production` before the Next.js build so they are available to the server runtime. The 10 MB upload size limit, allowed image types, and S3 upload prefix are defined in `lib/upload-constants.ts`. The region variable is named `S3_REGION` because Amplify reserves the `AWS_` prefix. Do not add long-lived AWS access keys to Amplify environment variables; attach an IAM SSR Compute role instead.

Configure bucket CORS once so the browser can submit the presigned upload:

```bash
aws s3api put-bucket-cors \
  --bucket statut-photo-enhancer-prod \
  --cors-configuration file://s3-cors.json \
  --profile default
```

If the site uses a custom domain, add its exact `https://...` origin to `s3-cors.json` and apply the command again. S3 accepts a single `*` wildcard in an allowed origin, which is used here for Amplify preview and production subdomains.

## Build version

The UI displays the package version, branch, and short commit SHA for the
deployed build. Amplify provides the commit and branch through `AWS_COMMIT_ID`
and `AWS_BRANCH`, so every commit deployed by Amplify gets a unique build label
without changing `package.json` on every commit.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
