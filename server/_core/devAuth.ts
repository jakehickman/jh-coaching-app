// Dev-only login shortcut — skips the Google OAuth round trip so changes can
// be clicked through locally. Only ever mounted when NODE_ENV=development
// (see server/_core/index.ts); never present in a production build.
import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

export function registerDevAuthRoutes(app: Express) {
  app.get("/api/dev/login", async (req: Request, res: Response) => {
    const email = typeof req.query.email === "string" ? req.query.email : "jake@jakehickman.com";
    const user = await db.getUserByEmail(email);
    if (!user) {
      res.status(404).json({ error: `No user found with email ${email}` });
      return;
    }

    const sessionToken = await sdk.createSessionToken(user.openId, {
      name: user.name || "",
      expiresInMs: SESSION_MAX_AGE_MS,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });
    res.redirect(302, "/dashboard");
  });
}
