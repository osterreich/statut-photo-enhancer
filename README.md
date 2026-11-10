# Statut Photo Enhancer

Next.js application with an initial image-upload flow. The current version accepts JPEG, PNG and WebP files and stores them in a private Amazon S3 bucket. Image enhancement will be added later.

## Local development

1. Copy `.env.example` to `.env.local` and set the S3 bucket and region.
2. Make sure the AWS SDK can resolve credentials locally through the AWS CLI profile, IAM Identity Center, or environment variables.
3. Start the app:

```bash
npm run dev
```

Open http://localhost:3000.

The server uploads files through `POST /api/upload`. AWS credentials are never sent to the browser.

## AWS setup

The S3 bucket should remain private. Give the local AWS identity and the Amplify SSR Compute role only the permissions needed for the upload prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/uploads/*"
    }
  ]
}
```

For Amplify, add the variables from `.env.example` in the app environment settings. `amplify.yml` writes these values to `.env.production` before the Next.js build so they are available to the server runtime. The upload size limit, allowed image types, and S3 upload prefix are defined as constants in `lib/upload-config.ts`. The region variable is named `S3_REGION` because Amplify reserves the `AWS_` prefix. Do not add long-lived AWS access keys to Amplify environment variables; attach an IAM SSR Compute role instead.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
