import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';

import {
  ACCESS_TOKEN_KEY,
  api,
  authApi,
  clearTokens,
  getAccessToken,
  loadStoredTokens,
  REFRESH_TOKEN_KEY,
  registerAuthFailureHandler,
  resolveBaseURL,
  setTokens,
} from '@/api/client';

type Adapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  const response: AxiosResponse = {
    data: { detail: 'Token expired' },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  };
  return new AxiosError('Unauthorized', AxiosError.ERR_BAD_REQUEST, config, undefined, response);
}

function serverError(config: InternalAxiosRequestConfig): AxiosError {
  const response: AxiosResponse = {
    data: { detail: 'boom' },
    status: 500,
    statusText: 'Server Error',
    headers: {},
    config,
  };
  return new AxiosError('Server Error', AxiosError.ERR_BAD_RESPONSE, config, undefined, response);
}

function authHeader(config: InternalAxiosRequestConfig): string | undefined {
  const value = AxiosHeaders.from(config.headers).get('Authorization');
  return value == null ? undefined : String(value);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('api client auth', () => {
  const onAuthFailure = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    (SecureStore as unknown as { __reset: () => void }).__reset();
    await clearTokens();
    registerAuthFailureHandler(onAuthFailure);
  });

  test('injects the in-memory access token as a Bearer header', async () => {
    await setTokens({ access: 'access-1', refresh: 'refresh-1' });
    let seen: string | undefined;
    api.defaults.adapter = (async (config) => {
      seen = authHeader(config);
      return ok(config, { fine: true });
    }) as Adapter;

    await api.get('/anything');
    expect(seen).toBe('Bearer access-1');
  });

  test('persists and reloads tokens through the secure store', async () => {
    await setTokens({ access: 'access-1', refresh: 'refresh-1' });
    expect(await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)).toBe('access-1');
    expect(await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)).toBe('refresh-1');

    // Simulate a cold start: memory wiped, then hydrated from disk.
    await loadStoredTokens();
    expect(getAccessToken()).toBe('access-1');
  });

  test('single-flight: concurrent 401s trigger exactly one refresh, then replay', async () => {
    await setTokens({ access: 'stale', refresh: 'refresh-1' });

    let refreshCalls = 0;
    authApi.defaults.adapter = (async (config) => {
      refreshCalls += 1;
      await delay(20); // keep the refresh in flight while both 401s queue
      return ok(config, { access: 'fresh', refresh: 'refresh-2' });
    }) as Adapter;

    let protectedCalls = 0;
    api.defaults.adapter = (async (config) => {
      protectedCalls += 1;
      if (authHeader(config) === 'Bearer fresh') {
        return ok(config, { ok: true, url: config.url });
      }
      throw unauthorized(config);
    }) as Adapter;

    const [first, second] = await Promise.all([api.get('/one'), api.get('/two')]);

    expect(refreshCalls).toBe(1);
    expect(first.data.ok).toBe(true);
    expect(second.data.ok).toBe(true);
    // 2 original calls + 2 replays
    expect(protectedCalls).toBe(4);
    expect(getAccessToken()).toBe('fresh');
    // Rotated refresh token persisted.
    expect(await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)).toBe('refresh-2');
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  test('refresh failure: purges tokens and fires the auth-failure handler once', async () => {
    await setTokens({ access: 'stale', refresh: 'dead-refresh' });

    authApi.defaults.adapter = (async (config) => {
      await delay(10);
      throw unauthorized(config);
    }) as Adapter;

    api.defaults.adapter = (async (config) => {
      throw unauthorized(config);
    }) as Adapter;

    const results = await Promise.allSettled([api.get('/one'), api.get('/two')]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)).toBeNull();
    expect(await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)).toBeNull();
  });

  test('missing refresh token: fails fast without calling the refresh endpoint', async () => {
    await setTokens({ access: 'stale', refresh: 'r' });
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);

    let refreshCalls = 0;
    authApi.defaults.adapter = (async (config) => {
      refreshCalls += 1;
      return ok(config, { access: 'nope' });
    }) as Adapter;
    api.defaults.adapter = (async (config) => {
      throw unauthorized(config);
    }) as Adapter;

    await expect(api.get('/one')).rejects.toBeInstanceOf(AxiosError);
    expect(refreshCalls).toBe(0);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  test('does not loop when the replayed request 401s again', async () => {
    await setTokens({ access: 'stale', refresh: 'refresh-1' });

    let refreshCalls = 0;
    authApi.defaults.adapter = (async (config) => {
      refreshCalls += 1;
      return ok(config, { access: 'fresh' });
    }) as Adapter;

    let protectedCalls = 0;
    api.defaults.adapter = (async (config) => {
      protectedCalls += 1;
      throw unauthorized(config); // always 401, even with the fresh token
    }) as Adapter;

    await expect(api.get('/one')).rejects.toBeInstanceOf(AxiosError);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2); // original + one replay, no loop
  });

  test('non-401 errors pass through without touching the refresh flow', async () => {
    await setTokens({ access: 'access-1', refresh: 'refresh-1' });

    let refreshCalls = 0;
    authApi.defaults.adapter = (async (config) => {
      refreshCalls += 1;
      return ok(config, { access: 'x' });
    }) as Adapter;
    api.defaults.adapter = (async (config) => {
      throw serverError(config);
    }) as Adapter;

    await expect(api.get('/boom')).rejects.toMatchObject({ response: { status: 500 } });
    expect(refreshCalls).toBe(0);
    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('access-1');
  });
});

/**
 * Release builds must not silently point at the phone.
 *
 * The fallback used to be `http://127.0.0.1:8000/api/v1` unconditionally, so an
 * EAS production build with no EXPO_PUBLIC_API_URL shipped an app where every
 * request went to localhost — no crash, no log, just nothing ever loading.
 */

/**
 * Release builds must not silently point at the phone.
 *
 * Two distinct bugs live here, both of which shipped:
 *  1. The fallback was `http://127.0.0.1:8000/api/v1` unconditionally, so an
 *     EAS production build with no EXPO_PUBLIC_API_URL shipped an app where
 *     every request went to localhost — no crash, no log, nothing ever loading.
 *  2. Fixing (1) by giving EXPO_PUBLIC_API_URL top priority broke the web
 *     demo: that variable holds the Windows hotspot gateway (192.168.137.1),
 *     an address only a PHONE can reach, so the browser hung 15s per request
 *     and the app sat on skeletons with nothing in the server log.
 */
describe('resolveBaseURL', () => {
  const PHONE_ONLY = 'http://192.168.137.1:18000/api/v1';

  test('an explicit API origin wins for native dev and every release build', () => {
    expect(resolveBaseURL('https://api.example.com/api/v1', true, null)).toBe(
      'https://api.example.com/api/v1',
    );
    expect(resolveBaseURL('https://api.example.com/api/v1', false, null)).toBe(
      'https://api.example.com/api/v1',
    );
  });

  test('a RELEASE build with no origin configured throws instead of guessing', () => {
    expect(() => resolveBaseURL(undefined, false, null)).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => resolveBaseURL('', false, null)).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  test('the error names the fix, not just the symptom', () => {
    expect(() => resolveBaseURL(undefined, false, null)).toThrow(/EAS build profile/);
  });

  test('native dev keeps the laptop fallback so local work needs no .env', () => {
    expect(resolveBaseURL(undefined, true, null)).toBe('http://127.0.0.1:8000/api/v1');
  });

  test('no build can ever resolve to loopback unless it is a dev build', () => {
    for (const env of [undefined, '']) {
      let resolved: string | null = null;
      try {
        resolved = resolveBaseURL(env, false, null);
      } catch {
        resolved = null;
      }
      expect(resolved).toBeNull();
    }
  });

  describe('dev web ignores EXPO_PUBLIC_API_URL — it is phone-only', () => {
    test('uses the page host on :18000, not the phone-only .env value', () => {
      expect(resolveBaseURL(PHONE_ONLY, true, 'localhost')).toBe('http://localhost:18000/api/v1');
    });

    test('follows the page host so a LAN preview works untouched', () => {
      expect(resolveBaseURL(PHONE_ONLY, true, '192.168.1.50')).toBe(
        'http://192.168.1.50:18000/api/v1',
      );
    });

    test('never routes the browser at the hotspot gateway', () => {
      for (const host of ['localhost', '127.0.0.1', '10.0.0.4']) {
        expect(resolveBaseURL(PHONE_ONLY, true, host)).not.toContain('192.168.137.1');
      }
    });

    test('a RELEASE web build DOES honour the configured origin', () => {
      // The page-host rule is dev-only: a real web deployment must reach its
      // real API, not <page-host>:18000.
      expect(resolveBaseURL('https://api.example.com/api/v1', false, 'app.example.com')).toBe(
        'https://api.example.com/api/v1',
      );
    });
  });
});

/**
 * Phone testing must not depend on a hand-edited IP.
 *
 * `app/.env` held the Windows hotspot gateway (192.168.137.1). The moment the
 * hotspot is off or the laptop changes Wi-Fi, that address routes nowhere and
 * every request hangs with no diagnostic. In a dev build the phone downloaded
 * the bundle from Metro, so Metro's host is by construction reachable — and it
 * is the same machine publishing the API on :18000.
 */
describe('resolveBaseURL — dev native derives the host from Metro', () => {
  const STALE = 'http://192.168.137.1:18000/api/v1';

  test('the Metro host wins over a stale .env value', () => {
    expect(resolveBaseURL(STALE, true, null, '192.168.10.246')).toBe(
      'http://192.168.10.246:18000/api/v1',
    );
  });

  test('switching network needs no edit — it follows Metro', () => {
    expect(resolveBaseURL(STALE, true, null, '10.0.0.7')).toBe('http://10.0.0.7:18000/api/v1');
    expect(resolveBaseURL(STALE, true, null, '192.168.137.1')).toBe(STALE);
  });

  test('no Metro host (simulator, plain node) falls back to .env', () => {
    expect(resolveBaseURL(STALE, true, null, null)).toBe(STALE);
  });

  test('web still wins over Metro — the browser cannot use a LAN phone route', () => {
    expect(resolveBaseURL(STALE, true, 'localhost', '192.168.10.246')).toBe(
      'http://localhost:18000/api/v1',
    );
  });

  test('a RELEASE build ignores Metro entirely and uses the configured origin', () => {
    expect(resolveBaseURL('https://api.example.com/api/v1', false, null, '192.168.10.246')).toBe(
      'https://api.example.com/api/v1',
    );
  });

  test('a RELEASE build with no origin still throws, Metro host or not', () => {
    expect(() => resolveBaseURL(undefined, false, null, '192.168.10.246')).toThrow(
      /EXPO_PUBLIC_API_URL/,
    );
  });
});
