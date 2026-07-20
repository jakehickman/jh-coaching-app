// Direct Google OAuth (Authorization Code flow) — replaces Manus's hosted
// OAuth relay. Requires a Google Cloud OAuth 2.0 Client ID (Web application)
// with GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET set, and the redirect URI
// (<your domain>/api/oauth/callback) registered in the Google Cloud Console.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ENV } from "./env";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export type GoogleUserInfo = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  if (!ENV.google.clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", ENV.google.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Exchange an authorization code for tokens, verify the returned ID token
 * against Google's public keys, and return the authenticated user's info.
 */
export async function exchangeCodeForGoogleUser(
  code: string,
  redirectUri: string
): Promise<GoogleUserInfo> {
  if (!ENV.google.clientId || !ENV.google.clientSecret) {
    throw new Error(
      "Google OAuth is not configured (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)"
    );
  }

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.google.clientId,
      client_secret: ENV.google.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "");
    throw new Error(
      `Google token exchange failed (${tokenResponse.status}): ${detail}`
    );
  }

  const tokenData = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenData.id_token) {
    throw new Error("Google token response did not include an id_token");
  }

  const { payload } = await jwtVerify(tokenData.id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: ENV.google.clientId,
  });

  const sub = payload.sub;
  if (!sub || typeof sub !== "string") {
    throw new Error("Google ID token missing subject claim");
  }

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : null,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === "string" ? payload.name : null,
  };
}
