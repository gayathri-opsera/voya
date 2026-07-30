/**
 * Session management for the frontend.
 * 
 * Stores the JWT access token in memory (not localStorage for XSS safety).
 * The refresh token is stored in an HttpOnly cookie set by the server.
 */

import { apiPost } from "./api/client.js";
import { configureAuth } from "./api/client.js";

interface SessionState {
  accessToken: string | null;
  userId: string | null;
  expiresAt: number | null;
}

const state: SessionState = {
  accessToken: null,
  userId: null,
  expiresAt: null,
};

// Wire auth header injection into the API client
configureAuth(() => state.accessToken);

export function getAccessToken(): string | null {
  // Auto-expire check
  if (state.expiresAt && Date.now() >= state.expiresAt) {
    clearSession();
    return null;
  }
  return state.accessToken;
}

export function setSession(token: string, userId: string, expiresInSeconds: number): void {
  state.accessToken = token;
  state.userId = userId;
  state.expiresAt = Date.now() + expiresInSeconds * 1000;
}

export function clearSession(): void {
  state.accessToken = null;
  state.userId = null;
  state.expiresAt = null;
}

export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

export async function refreshSession(): Promise<boolean> {
  try {
    const res = await apiPost<{ accessToken: string; userId: string; expiresIn: number }>(
      "/auth/refresh",
      {},
    );
    setSession(res.accessToken, res.userId, res.expiresIn);
    return true;
  } catch {
    clearSession();
    return false;
  }
}
