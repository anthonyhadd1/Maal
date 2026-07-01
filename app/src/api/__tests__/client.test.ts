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
