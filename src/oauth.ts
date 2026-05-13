/**
 * oauth.ts
 * Handles the Fitbit OAuth 2.0 Authorization Code flow.
 * Reference: https://dev.fitbit.com/build/reference/web-api/developer-guide/authorization/
 */

import http from "node:http";
import { getTokens, saveTokens, type TokenData } from "./tokenStore.js";

// ---------------------------------------------------------------------------
// Types and interfaces :(
// ---------------------------------------------------------------------------

/** Shape of the JSON body returned by Fitbit's token endpoint. */
export interface FitbitTokenResponse {
  access_token: string;
  refresh_token: string;
  /** Lifetime in seconds (e.g. 28800 = 8 h). */
  expires_in: number;
  token_type: string;
  scope: string;
  user_id: string;
}

// ---------------------------------------------------------------------------
// Constants (read once at start-up; crash early if missing)
// ---------------------------------------------------------------------------

const CLIENT_ID = requireEnv("FITBIT_CLIENT_ID");
const CLIENT_SECRET = requireEnv("FITBIT_CLIENT_SECRET");
const REDIRECT_URI = requireEnv("FITBIT_REDIRECT_URI");

const AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const SCOPES = "activity heartrate sleep profile";

// ---------------------------------------------------------------------------
// Helpers 💪
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Build the Fitbit authorization URL that the user is redirected to.
 * Step 1 of the OAuth flow.
 */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Start a one-shot local callback server and wait for Fitbit to redirect
 * with a ?code=... value.
 */
export function waitForOAuthCode(port = 3000, timeoutMs = 120_000): Promise<{ code: string; state: string | null }> {
  const callbackPath = new URL(REDIRECT_URI).pathname;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close(() => {
        reject(new Error(`OAuth callback timed out after ${timeoutMs} ms`));
      });
    }, timeoutMs);

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "", `http://localhost:${port}`);

      if (url.pathname !== callbackPath) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>Authentication successful. You may close this tab.</h1>");

      clearTimeout(timer);
      server.close();

      if (error) {
        reject(new Error(`Authorization denied: ${error}`));
        return;
      }

      if (code) {
        resolve({ code, state });
        return;
      }

      reject(new Error("No code found in callback"));
    });

    server.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    server.listen(port);
  });
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Step 2 of the OAuth flow.
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<TokenData> {
  // Fitbit requires HTTP Basic auth: base64(client_id:client_secret)
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    "base64"
  );

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Token exchange failed (${response.status}): ${text}`
    );
  }

  const json = (await response.json()) as FitbitTokenResponse;
  return toTokenData(json);
}

/**
 * Run the interactive CLI login flow.
 */
export async function loginViaEphemeralCallbackServer(port = 3000): Promise<void> {
  const state = Math.random().toString(36).slice(2);
  const authUrl = buildAuthUrl(state);

  console.log("Open this URL on any device to authorize Fitbit:");
  console.log(authUrl);
  console.log(`\nWaiting for callback on http://localhost:${port}${new URL(REDIRECT_URI).pathname} ...`);

  const { code, state: callbackState } = await waitForOAuthCode(port);

  if (callbackState !== state) {
    throw new Error("OAuth state mismatch in callback");
  }

  const tokens = await exchangeCodeForTokens(code);
  saveTokens(tokens);

  console.log("Authentication successful. Tokens saved.");
}

/**
 * Refresh an expired access token using the stored refresh token.
 * Called automatically by ensureValidAccessToken().
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenData> {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    "base64"
  );

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Token refresh failed (${response.status}): ${text}`
    );
  }

  const json = (await response.json()) as FitbitTokenResponse;
  return toTokenData(json);
}

/**
 * Returns a valid access token, refreshing it first if it has expired.
 * Use this before every Fitbit API call.
 */
export async function ensureValidAccessToken(): Promise<string> {
  const tokens = getTokens();
  if (!tokens) {
    throw new Error("Not authorised. Run `npm run login` to start the OAuth flow.");
  }

  // Refresh 60 s before actual expiry to avoid edge-case failures.
  const isExpired = Date.now() >= tokens.expires_at - 60_000;
  if (isExpired) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    saveTokens(refreshed);
    return refreshed.access_token;
  }

  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert a raw Fitbit token response into the internal TokenData shape. */
function toTokenData(raw: FitbitTokenResponse): TokenData {
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    // expires_in is in seconds; store absolute timestamp in ms.
    expires_at: Date.now() + raw.expires_in * 1000,
  };
}
