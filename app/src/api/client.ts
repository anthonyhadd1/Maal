import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { ENDPOINTS } from '@/api/endpoints';
import type { Tokens } from '@/api/types';
import * as SecureStore from '@/lib/secureStorage';

/**
 * Axios instances + token lifecycle.
 *
 * - Access token mirrored in memory (no SecureStore read per request).
 * - Tokens persisted via the secureStorage adapter under `ace.access` /
 *   `ace.refresh` (expo-secure-store on native, localStorage on the web demo).
 * - 401 handling: single-flight refresh mutex — concurrent 401s all await ONE
 *   `POST /auth/token/refresh/`, then replay their original request.
 * - Refresh failure: purge tokens + notify the auth store (registered callback,
 *   avoids a circular import).
 */

export const ACCESS_TOKEN_KEY = 'ace.access';
export const REFRESH_TOKEN_KEY = 'ace.refresh';

/** Dev-only convenience default; never reachable from a shipped build. */
const DEV_FALLBACK_URL = 'http://127.0.0.1:8000/api/v1';

/** The page's hostname when running as a web bundle, else null. */
function currentWebHost(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.location?.hostname ?? null;
}

/**
 * The LAN address of the machine running Metro, as the PHONE resolved it.
 *
 * In a dev build the bundle is downloaded from the laptop, so `hostUri` is by
 * construction an address this device can already reach — the same laptop that
 * publishes the API on :18000. Deriving from it makes phone testing work on
 * any network with no .env edit, which matters because a hardcoded IP goes
 * stale the moment you switch Wi-Fi or toggle the hotspot (and then every
 * request hangs with no clue why).
 */
function metroHost(): string | null {
  if (Platform.OS === 'web') return null;
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost;
  const host = hostUri?.split(':')[0]?.trim();
  if (!host) return null;
  // A tunnel/LAN name is fine; loopback is not — that would be the phone.
  if (host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

/**
 * Resolve the API origin. Precedence, highest first:
 *
 * 1. **Dev web** — the page's own host on :18000, IGNORING
 *    EXPO_PUBLIC_API_URL. That variable holds an address only a PHONE can
 *    reach, so letting it win here points the browser demo somewhere it cannot
 *    route to: every request hangs until timeout and the app sits on skeletons.
 * 2. **Dev native** — the Metro host on :18000, same reasoning in reverse: the
 *    phone can definitely reach whatever served it the bundle.
 * 3. **EXPO_PUBLIC_API_URL** — every release build, and any dev case the two
 *    rules above cannot infer.
 * 4. **Dev fallback** — the laptop's published port, for a simulator.
 *
 * A RELEASE build with nothing configured throws. It used to fall back to
 * 127.0.0.1, so a store build would quietly point every request at the phone
 * itself: no crash, no log, just an app where nothing ever loads.
 */
export function resolveBaseURL(
  env: string | undefined = process.env.EXPO_PUBLIC_API_URL,
  isDev: boolean = __DEV__,
  // Injected rather than read inline so the host rules are testable: the Jest
  // preset runs as native with no `window` and no Metro.
  webHost: string | null = currentWebHost(),
  devHost: string | null = metroHost(),
): string {
  if (isDev && webHost) return `http://${webHost}:18000/api/v1`;
  if (isDev && devHost) return `http://${devHost}:18000/api/v1`;

  if (env) return env;

  if (!isDev) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set. A release build has no usable API origin — ' +
        'set it in the EAS build profile (see DEPLOY.md) and rebuild.',
    );
  }

  return DEV_FALLBACK_URL;
}

const baseURL = resolveBaseURL();

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
