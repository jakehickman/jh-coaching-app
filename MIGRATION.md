# Migrating off Manus — status and next steps

This tracks the move of this app off Manus's hosted services onto standalone
infrastructure you control. Written for Jake, picking this up as a learning
project.

## Urgent: rotate your database password

`.manus/db/` (98 files) was Manus's local debug log of every SQL query run
against your production database, and it was **committed to this public
GitHub repo**. Those files included your database host, port, and username
(TiDB Cloud, at `gateway05.us-east-1.prod.aws.tidbcloud.com`) — no password
was found in them, but the connection details being public is still a real
exposure.

What's been done: the file contents have been scrubbed (emptied) in your
local copy, and `.manus/` is now in `.gitignore` so this can't happen again.

What you still need to do:
1. Get your current `DATABASE_URL` from Manus (see "Finding your database
   credentials" below) before you lose access.
2. Once you've migrated to a database you control (see below), the old
   Manus-provisioned one becomes irrelevant — but until then, treat that
   connection as compromised: change its password the moment you're able to,
   via whatever TiDB Cloud / Manus panel gave it to you.
3. Push these changes (including the scrubbed `.manus/db/` files and the
   updated `.gitignore`) to GitHub. Note: this does **not** remove the old
   exposed data from your git *history* — it's still visible in old commits.
   If that matters to you (e.g. if a password does turn out to be in an
   older commit), say so and we can look at scrubbing history or starting a
   fresh repo.

## What changed in the code

Three things were previously proxied through Manus's own backend
(`forge.manus.im` and a Manus OAuth relay). All three now use standard,
directly-controlled services:

- **Login** — was: redirect to Manus's hosted sign-in page. Now: direct
  Google OAuth (`server/_core/googleAuth.ts`, `server/_core/oauth.ts`,
  `server/_core/sdk.ts`, `client/src/const.ts`). Existing users are matched
  by email on their first Google login so no one loses their account.
- **File storage** (progress photos, meal-log photos) — was: Manus's
  storage proxy. Now: real AWS S3 (`server/storage.ts`). No changes needed
  in the features that use it.
- **"New client signed up" notification** — was: Manus's notification
  service. Now: just logs to the console (`server/_core/notification.ts`).
  Not wired to anything real yet — low priority, easy to add later (e.g.
  email via SES/Resend, or a Slack webhook).

Also removed: unused Manus boilerplate for LLM calls, AI image generation,
and voice transcription (none of it was actually used by the app), the
Manus Vite plugin, and the Manus debug-log collector.

## What you need to set up before this will run

See `.env.example` for the full list of environment variables. In order:

1. **Database** — a MySQL-compatible host you control (PlanetScale,
   Railway, a plain RDS instance, or your own TiDB Cloud account all work
   fine — the app code doesn't care). Export your data from the current
   database and import it here. Set `DATABASE_URL`.
2. **Google OAuth client** — in Google Cloud Console, create an OAuth 2.0
   Client ID (type: Web application). Add
   `https://<your-domain>/api/oauth/callback` and
   `http://localhost:3000/api/oauth/callback` (for local dev) as authorized
   redirect URIs. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
   `VITE_GOOGLE_CLIENT_ID` (same client ID).
3. **S3 bucket** — create one, and an IAM user/role with put/get access to
   it. Set `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`.
4. **JWT_SECRET** — any long random string (`openssl rand -base64 48`).
5. **OWNER_EMAIL** — your own email address, so you automatically get the
   coach/admin role on first sign-in.

### Finding your database credentials in Manus

If you're not sure where to look: Manus projects typically expose their
environment variables somewhere in the project's settings/deployment panel
— look for `DATABASE_URL` specifically. If you can't find it, that's worth
flagging back to whoever's helping you — worst case, we can look at what
data can be exported directly from the app itself (client rosters, logs,
etc.) and rebuild the rest.

## Not done yet

- Actually running the app locally (needs the env vars above filled in with
  real values first).
- Choosing and setting up a host for deployment.
- Full git-history scrub of the exposed `.manus/db` files, if you want it.
