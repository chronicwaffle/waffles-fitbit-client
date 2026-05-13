/**
 * oauth.ts
 * Handles the Fitbit OAuth 2.0 Authorization Code flow.
 * Reference: https://dev.fitbit.com/build/reference/web-api/developer-guide/authorization/
 */

import { getTokens, saveTokens, type TokenData } from "./tokenStore.js";

// ---------------------------------------------------------------------------
// Types
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
// Helpers
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
    throw new Error("Not authorised. Visit /login to start the OAuth flow.");
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
