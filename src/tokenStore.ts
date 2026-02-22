/** In-memory token store for a single personal-use account. */

export interface TokenData {
  access_token: string;
  refresh_token: string;
  /** Unix timestamp (ms) after which the access token is considered expired. */
  expires_at: number;
}

// Holds the current token set; null until the first OAuth callback completes.
let tokenData: TokenData | null = null;

/** Persist a new token set (called after token exchange or token refresh). */
export function saveTokens(data: TokenData): void {
  tokenData = data;
}

/** Retrieve the stored tokens, or null if not yet authorised. */
export function getTokens(): TokenData | null {
  return tokenData;
}
