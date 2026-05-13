/**
 * server.ts
 * Express application wiring together the OAuth flow and Fitbit API routes.
 *
 * First-run instructions:
 *  1. Copy .env.example to .env and fill in your Fitbit app credentials.
 *  2. Run `npm run dev` (or `npm start` after `npm run build`).
 *  3. Open http://localhost:3000/login in your browser to authorise.
 *  4. After the redirect you can call /me and /activities/today.
 */

import "dotenv/config";
import crypto from "crypto";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import { buildAuthUrl, exchangeCodeForTokens } from "./oauth.js";
import { saveTokens } from "./tokenStore.js";
import { getUserProfile, getTodayActivities } from "./fitbit.js";

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
const PORT = process.env.PORT ?? "3000";

const sessionSecret = require('crypto').randomBytes(32).toString('hex');
process.env.SESSION_SECRET = sessionSecret;
console.log(sessionSecret);

const SESSION_SECRET = process.env.SESSION_SECRET ?? sessionSecret
if (!SESSION_SECRET) {
  throw new Error("Missing required environment variable: SESSION_SECRET");
}

// Session middleware – used only to round-trip the OAuth state parameter.
// cookie.secure is set to true in production to enforce HTTPS-only delivery.
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

// Extend the session type to include the OAuth state field.
declare module "express-session" {
  interface SessionData {
    oauthState?: string;
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Rate-limiter applied to auth endpoints to mitigate brute-force / abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * GET /login
 * Kick off the OAuth 2.0 Authorization Code flow:
 *  - Generate a random state token and store it in the session.
 *  - Redirect the browser to Fitbit's authorization page.
 */
app.get("/login", authLimiter, (req: Request, res: Response): void => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  const authUrl = buildAuthUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /callback
 * Fitbit redirects here with ?code=...&state=...
 *  - Validate the state param to prevent CSRF.
 *  - Exchange the code for access + refresh tokens.
 *  - Persist tokens in the in-memory store.
 */
app.get(
  "/callback",
  authLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code, state, error } = req.query as Record<string, string>;

      // User denied the authorization request.
      if (error) {
        res.status(400).json({ error: `Authorization denied: ${error}` });
        return;
      }

      // CSRF protection: state must match what we stored in the session.
      if (!state || state !== req.session.oauthState) {
        res.status(400).json({ error: "Invalid or missing state parameter." });
        return;
      }

      if (!code) {
        res.status(400).json({ error: "Missing authorization code." });
        return;
      }

      // Exchange authorization code for tokens.
      const tokens = await exchangeCodeForTokens(code);
      saveTokens(tokens);

      // Clean up the one-time state value from the session.
      delete req.session.oauthState;

      res.json({ success: true, message: "Authorised! Try /me or /activities/today." });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /me
 * Returns the authenticated user's Fitbit profile.
 */
app.get(
  "/me",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await getUserProfile();
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /activities/today
 * Returns today's activity summary for the authenticated user.
 */
app.get(
  "/activities/today",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const activities = await getTodayActivities();
      res.json(activities);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[error]", message);
  res.status(500).json({ error: message });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\nwaffles-fitbit-client running on http://localhost:${PORT}`);
  console.log("──────────────────────────────────────────────");
  console.log("First-run instructions:");
  console.log("  1. Copy .env.example → .env and fill in your Fitbit credentials.");
  console.log("  2. Visit http://localhost:" + PORT + "/login to authorise your account.");
  console.log("  3. After the redirect, call /me or /activities/today.");
  console.log("──────────────────────────────────────────────\n");
});

export default app;
