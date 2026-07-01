import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

import { ENDPOINTS } from '@/api/endpoints';
import type { Tokens } from '@/api/types';

/**
 * Axios instances + token lifecycle.
 *
 * - Access token mirrored in memory (no SecureStore read per request).
 * - Tokens persisted in expo-secure-store under `ace.access` / `ace.refresh`.
 * - 401 handling: single-flight refresh mutex — concurrent 401s all await ONE
 *   `POST /auth/token/refresh/`, then replay their original request.
 * - Refresh failure: purge tokens + notify the auth store (registered callback,
 *   avoids a circular import).
 */

export const ACCESS_TOKEN_KEY = 'ace.access';
export const REFRESH_TOKEN_KEY = 'ace.refresh';

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/v1';

let accessToken: string | null = null;
let authFailureHandler: (() => void) | null = null;

/** Called exactly once per failed refresh (after tokens are purged). */
export function registerAuthFailureHandler(handler: () => void): void {
  authFailureHandler = handler;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export async function setTokens(tokens: Tokens): Promise<void> {
  accessToken = tokens.access;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.access),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

/**
 * Boot-time hydration: loads the access token into memory.
 * Returns true when a refresh token exists (i.e. a session can be resumed).
 */
export async function loadStoredTokens(): Promise<boolean> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  accessToken = access;
  return refresh != null;
}

/** Token-free instance for register/login/refresh — no interceptors. */
export const authApi = axios.create({ baseURL, timeout: 15_000 });

/** Authenticated instance — Bearer injection + 401 refresh/replay. */
export const api = axios.create({ baseURL, timeout: 15_000 });

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// --- 401 single-flight refresh -------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

async function handleAuthFailure(): Promise<void> {
  await clearTokens();
  authFailureHandler?.();
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refresh) {
    await handleAuthFailure();
    return null;
  }
  try {
    const { data } = await authApi.post<{ access: string; refresh?: string }>(
      ENDPOINTS.authRefresh,
      { refresh },
    );
    accessToken = data.access;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.access);
    // simplejwt rotation is on: persist the rotated refresh token when present.
    if (data.refresh) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, data.refresh);
    }
    return data.access;
  } catch {
    await handleAuthFailure();
    return null;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as RetriableConfig | undefined;
  if (error.response?.status !== 401 || !original || original._retry) {
    throw error;
  }

  // Single flight: the first 401 kicks off the refresh; concurrent 401s queue
  // behind the same promise.
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  const newAccess = await refreshPromise;
  if (!newAccess) {
    throw error;
  }

  original._retry = true;
  const headers = AxiosHeaders.from(original.headers);
  headers.set('Authorization', `Bearer ${newAccess}`);
  original.headers = headers;
  return api.request(original);
});
