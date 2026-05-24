import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { notifyOwner } from "./notification";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      // Extract invite token from state if present (encoded as JSON: {redirectUri, inviteToken})
      let inviteToken: string | undefined;
      let redirectUri: string | undefined;
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString());
        redirectUri = decoded.redirectUri;
        inviteToken = decoded.inviteToken;
      } catch {
        // Legacy: state is just base64(redirectUri)
        redirectUri = Buffer.from(state, "base64").toString();
      }

      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Check if this is a new user before upserting
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      const isNewUser = !existingUser;

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Redeem invite token if present — auto-approve and assign to coach
      if (inviteToken) {
        try {
          const invite = await db.getInviteToken(inviteToken);
          if (invite && !invite.usedByUserId && (!invite.expiresAt || invite.expiresAt > new Date())) {
            const user = await db.getUserByOpenId(userInfo.openId);
            if (user) {
              await db.setUserApproved(user.id, true);
              await db.redeemInviteToken(inviteToken, user.id);
              // Ensure client profile exists and is linked to coach
              await db.upsertClientProfile(user.id, { coachId: invite.coachId });
            }
          }
        } catch (e) {
          console.error("[OAuth] Invite redemption failed", e);
        }
      }

      // Notify owner when a new client signs up (fire-and-forget, never blocks login)
      if (isNewUser) {
        const displayName = userInfo.name || userInfo.email || userInfo.openId;
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

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
