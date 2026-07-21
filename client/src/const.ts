export { COOKIE_NAME } from "@shared/const";

// Login is server-initiated (server/_core/oauth.ts: GET /api/oauth/login) so
// the server can set a CSRF nonce cookie before redirecting to Google, then
// verify it on callback. This just points at that endpoint.
export const getLoginUrl = (opts: { inviteToken?: string } = {}) => {
  const url = new URL("/api/oauth/login", window.location.origin);
  if (opts.inviteToken) url.searchParams.set("inviteToken", opts.inviteToken);
  return url.toString();
};
