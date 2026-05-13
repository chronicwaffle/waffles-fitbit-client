/**
 * fitbit.ts
 * Thin wrappers around Fitbit Web API endpoints.
 * Each function calls ensureValidAccessToken() before making a request.
 */

import { ensureValidAccessToken } from "./oauth.js";

const API_BASE = "https://api.fitbit.com";

/** Perform an authenticated GET to a Fitbit API endpoint. */
async function fitbitGet<T>(path: string): Promise<T> {
  const token = await ensureValidAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Fitbit API error ${response.status} for ${path}: ${text}`
    );
  }

  return response.json() as Promise<T>;
}

/** Fetch the authenticated user's profile. */
export async function getUserProfile(): Promise<unknown> {
  return fitbitGet("/1/user/-/profile.json");
}

/** Fetch today's activity summary for the authenticated user. */
export async function getTodayActivities(): Promise<unknown> {
  return fitbitGet("/1/user/-/activities/date/today.json");
}
