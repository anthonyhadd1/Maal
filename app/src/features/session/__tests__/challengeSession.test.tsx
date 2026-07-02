import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { PropsWithChildren } from 'react';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { queryClient as singletonQueryClient } from '@/api/queryClient';
import { useSessionEngine } from '@/features/session/useSessionEngine';
import { useSessionStore } from '@/stores/sessionStore';
import { LEVEL_ID, startAttemptResponse } from '@/test/fixtures/session';

/**
 * Challenge entry path (Phase 7): the SAME engine starts the attempt via
 * POST /challenges/{id}/attempts/ and everything downstream is untouched.
 * Mocking swaps the axios adapter (same pattern as useSessionEngine.test).
 */

const CHALLENGE_ID = 9;

type Adapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

let requests: { url: string; body: unknown }[] = [];
let originalAdapter: unknown;

const contractAdapter: Adapter = async (config) => {
  const url = config.url ?? '';
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  requests.push({ url, body });

  if (url === ENDPOINTS.challengeAttempts(CHALLENGE_ID)) {
    return ok(config, startAttemptResponse);
  }
  if (url === ENDPOINTS.levelAttempts(LEVEL_ID)) {
    return ok(config, startAttemptResponse);
  }
  throw new Error(`unexpected request ${url}`);
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: 0, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useSessionEngine — challenge start source', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    requests = [];
    originalAdapter = api.defaults.adapter;
    api.defaults.adapter = contractAdapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter as never;
    singletonQueryClient.clear();
  });

  test('challengeId option: starts via POST /challenges/{id}/attempts/ and tags the store', async () => {
    const { result } = await renderHook(
      () => useSessionEngine(LEVEL_ID, {}, { challengeId: CHALLENGE_ID }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.phase).toBe('question'));

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(ENDPOINTS.challengeAttempts(CHALLENGE_ID));

    const store = useSessionStore.getState();
    expect(store.challengeId).toBe(CHALLENGE_ID);
    expect(store.levelId).toBe(LEVEL_ID);
    expect(store.attemptId).toBe(startAttemptResponse.attempt_id);
    expect(store.status).toBe('inProgress');
  });

  test('default engine (no options) still starts via the level endpoint, challengeId null', async () => {
    const { result } = await renderHook(() => useSessionEngine(LEVEL_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.phase).toBe('question'));

    expect(requests[0].url).toBe(ENDPOINTS.levelAttempts(LEVEL_ID));
    expect(useSessionStore.getState().challengeId).toBeNull();
  });

  test('a persisted LEVEL session does NOT get resumed as a challenge (start-source mismatch)', async () => {
    // Seed a plain level session (as if crash-recovered).
    useSessionStore.getState().startSession({
      attemptId: 777,
      levelId: LEVEL_ID,
      questions: startAttemptResponse.questions,
    });

    const { result } = await renderHook(
      () => useSessionEngine(LEVEL_ID, {}, { challengeId: CHALLENGE_ID }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.phase).toBe('question'));

    // A fresh challenge attempt was started instead of resuming the level one.
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(ENDPOINTS.challengeAttempts(CHALLENGE_ID));
    expect(useSessionStore.getState().challengeId).toBe(CHALLENGE_ID);
  });

  test('sessionStore: reset clears the challenge tag', () => {
    useSessionStore.getState().startSession({
      attemptId: 1,
      levelId: LEVEL_ID,
      questions: startAttemptResponse.questions,
      challengeId: CHALLENGE_ID,
    });
    expect(useSessionStore.getState().challengeId).toBe(CHALLENGE_ID);

    useSessionStore.getState().reset();
    expect(useSessionStore.getState().challengeId).toBeNull();
  });
});
