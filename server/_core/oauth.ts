import { randomBytes } from "node:crypto";
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { buildGoogleAuthUrl, exchangeCodeForGoogleUser } from "./googleAuth";
import { notifyOwner } from "./notification";
import { sdk } from "./sdk";

const OAUTH_NONCE_COOKIE = "oauth_nonce";
const NONCE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes — just long enough for the Google redirect round trip

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getCallbackRedirectUri(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/api/oauth/callback`;
}

function getCookie(req: Request, name: string): string | undefined {
  const parsed = parseCookieHeader(req.headers.cookie ?? "");
  return parsed[name];
}

export function registerOAuthRoutes(app: Express) {
  // Server-initiated login: issues a CSRF nonce (stored in a short-lived cookie
  // and echoed back in `state`) before handing off to Google, so the callback
  // can verify the response actually followed a login we started.
  app.get("/api/oauth/login", (req: Request, res: Response) => {
    const inviteToken = getQueryParam(req, "inviteToken");
    const redirectUri = getCallbackRedirectUri(req);
    const nonce = randomBytes(16).toString("hex");

    const state = Buffer.from(
      JSON.stringify({ redirectUri, inviteToken, nonce })
    ).toString("base64");

    res.cookie(OAUTH_NONCE_COOKIE, nonce, {
      ...getSessionCookieOptions(req),
      path: "/api/oauth",
      maxAge: NONCE_MAX_AGE_MS,
    });

    res.redirect(302, buildGoogleAuthUrl(redirectUri, state));
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      // Extract invite token from state if present (encoded as JSON: {redirectUri, inviteToken, nonce})
      let inviteToken: string | undefined;
      let redirectUri: string | undefined;
      let nonce: string | undefined;
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString());
        redirectUri = decoded.redirectUri;
        inviteToken = decoded.inviteToken;
        nonce = decoded.nonce;
      } catch {
        // Legacy: state is just base64(redirectUri)
        redirectUri = Buffer.from(state, "base64").toString();
      }

      // Verify the CSRF nonce when the flow included one (i.e. it went through
      // /api/oauth/login above). Flows that don't carry a nonce — e.g. a native
      // mobile client building its own Google auth URL with a custom-scheme
      // redirect_uri — fall through unverified, same as before this change.
      if (nonce) {
        const cookieNonce = getCookie(req, OAUTH_NONCE_COOKIE);
        res.clearCookie(OAUTH_NONCE_COOKIE, { path: "/api/oauth" });
        if (!cookieNonce || cookieNonce !== nonce) {
          res.status(400).json({ error: "invalid or expired login state" });
          return;
        }
      }

      const googleUser = await exchangeCodeForGoogleUser(
        code,
        getCallbackRedirectUri(req)
      );

      if (!googleUser.sub) {
        res.status(400).json({ error: "sub missing from Google user info" });
        return;
      }

      // Look up the user by their Google subject id first. If that misses,
      // fall back to matching by email — this covers accounts created
      // before the migration off Manus's auth relay, whose openId was a
      // Manus-issued id rather than a Google subject id. When we find a
      // match this way, re-point that account at the new Google sub so
      // future logins resolve directly.
      let existingUser = await db.getUserByOpenId(googleUser.sub);
      let isNewUser = !existingUser;

      if (!existingUser && googleUser.email) {
        const emailMatch = await db.getUserByEmail(googleUser.email);
        if (emailMatch) {
          await db.relinkUserOpenId(emailMatch.id, googleUser.sub);
          existingUser = { ...emailMatch, openId: googleUser.sub };
          isNewUser = false;
        }
      }

      // Invite-only: block new sign-ups that don't have a valid invite token
      if (isNewUser && !inviteToken) {
        res.redirect(302, `/?error=invite_required`);
        return;
      }

      await db.upsertUser({
        openId: googleUser.sub,
        name: googleUser.name || null,
        email: googleUser.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Redeem invite token if present — auto-approve and assign to coach
      if (inviteToken) {
        try {
          const invite = await db.getInviteToken(inviteToken);
          if (invite && !invite.usedByUserId && (!invite.expiresAt || invite.expiresAt > new Date())) {
            const user = await db.getUserByOpenId(googleUser.sub);
            if (user) {
              await db.setUserApproved(user.id, true);
              await db.redeemInviteToken(inviteToken, user.id);
              // Ensure client profile exists and is linked to coach
              await db.upsertClientProfile({ userId: user.id, coachId: invite.coachId });
            }
          }
        } catch (e) {
          console.error("[OAuth] Invite redemption failed", e);
        }
      }

      // Notify owner when a new client signs up (fire-and-forget, never blocks login)
      if (isNewUser) {
        const displayName = googleUser.name || googleUser.email || googleUser.sub;
        Promise.resolve()
          .then(() =>
            notifyOwner({
              title: "New client signed up",
              content: inviteToken
                ? `${displayName} joined via invite link and has been auto-approved.`
                : `${displayName} just created an account. Go to the Coach Panel to review and approve them.`,
            })
          )
          .catch(() => {});
      }

      const sessionToken = await sdk.createSessionToken(googleUser.sub, {
        name: googleUser.name || "",
        expiresInMs: SESSION_MAX_AGE_MS,
      });

      // Detect mobile deep link redirect (custom scheme like jhcoaching://)
      const isMobileRedirect = redirectUri && !redirectUri.startsWith("http");

      if (isMobileRedirect && redirectUri) {
        // Mobile: pass the JWT as a query param in the deep link — no cookie needed
        const separator = redirectUri.includes("?") ? "&" : "?";
        res.redirect(302, `${redirectUri}${separator}token=${encodeURIComponent(sessionToken)}`);
      } else {
        // Web: set cookie and redirect to dashboard as before
        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
        res.redirect(302, "/dashboard");
      }
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
