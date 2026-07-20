export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate the Google sign-in URL at runtime so the redirect URI reflects
// the current origin. Requires VITE_GOOGLE_CLIENT_ID to be set at build
// time to the OAuth 2.0 Web Client ID from Google Cloud Console, with
// "<origin>/api/oauth/callback" registered as an authorized redirect URI.
export const getLoginUrl = (opts: { inviteToken?: string } = {}) => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(
    JSON.stringify({ redirectUri, inviteToken: opts.inviteToken })
  );

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("state", state);

  return url.toString();
};
