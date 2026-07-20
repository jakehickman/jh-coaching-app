export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  // Preferred way to grant the admin/coach role — stable and human-settable,
  // unlike ownerOpenId which is an opaque Google subject id.
  ownerEmail: (process.env.OWNER_EMAIL ?? "").toLowerCase(),
  isProduction: process.env.NODE_ENV === "production",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  s3: {
    bucket: process.env.S3_BUCKET ?? "",
    region: process.env.AWS_REGION ?? "",
    // Optional custom public base URL (e.g. a CloudFront domain). Falls back
    // to the default S3 virtual-hosted URL when unset.
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? "",
  },
};
