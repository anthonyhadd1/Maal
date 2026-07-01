import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { api } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { queryClient as singletonQueryClient } from '@/api/queryClient';
import type { AnswerResponse } from '@/api/types';
import { useSessionEngine } from '@/features/session/useSessionEngine';
import { useSessionStore } from '@/stores/sessionStore';
import {
  ATTEMPT_ID,
  completeResponse,
  correctAnswer,
  LEVEL_ID,
  startAttemptResponse,
  wrongAnswer,
} from '@/test/fixtures/session';

/**
 * Engine tests against MOCKED SERVER RESPONSES following the PLAN contract
 * exactly — a parallel agent implements the same contract server-side.
 * Mocking swaps the axios adapter (same pattern as api/__tests__/client.test).
 */

type Adapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function codedError(
  config: InternalAxiosRequestConfig,
  status: number,
  body: Record<string, unknown>,
): AxiosError {
  const response: AxiosResponse = {
    data: body,
    status,
    statusText: 'Error',
    headers: {},
    config,
  };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response);
}

let answerQueue: AnswerResponse[] = [];
let requests: { url: string; body: unknown }[] = [];
let originalAdapter: unknown;

/** Contract-faithful fake backend. */
const contractAdapter: Adapter = async (config) => {
  const url = config.url ?? '';
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  requests.push({ url, body });

  if (url === ENDPOINTS.levelAttempts(LEVEL_ID)) {
    return ok(config, startAttemptResponse);
  }
  if (url === ENDPOINTS.attemptAnswers(ATTEMPT_ID)) {
    const next = answerQueue.shift();
    if (!next) throw new Error('answer queue empty');
    return ok(config, next);
  }
  if (url === ENDPOINTS.attemptComplete(ATTEMPT_ID)) {
    return ok(config, completeResponse);
  }
  if (url === ENDPOINTS.attemptAbandon(ATTEMPT_ID)) {
    return ok(config, {});
  }
  throw new Error(`unexpected request ${url}`);
};

function createWrapper() {
  const client = new QueryClient({
    // gcTime 0: no lingering GC timers keeping the jest worker alive.
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: 0, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** Awaited act: React 19 act() is a thenable; updates flush inside it. */
async function actAsync(callback: () => void): Promise<void> {
  await act(async () => {
    callback();
  });
}

function renderEngine(callbacks?: Parameters<typeof useSessionEngine>[1]) {
  return renderHook(() => useSessionEngine(LEVEL_ID, callbacks), { wrapper: createWrapper() });
}

const startCalls = () => requests.filter((r) => r.url === ENDPOINTS.levelAttempts(LEVEL_ID)).length;

describe('useSessionEngine', () => {
  beforeEach(() => {
    useSessionStore.getState().reset();
    answerQueue = [];
    requests = [];
    originalAdapter = api.defaults.adapter;
    api.defaults.adapter = contractAdapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter as never;
    // useSubmitAnswer touches the singleton cache — drop its GC timers.
    singletonQueryClient.clear();
  });

  test('loading → question: starts an attempt and seeds the store', async () => {
    const { result } = await renderEngine();
    // Mount kicks off the start mutation (phase 'loading' until it resolves).
    await waitFor(() => expect(result.current.phase).toBe('question'));

    expect(startCalls()).toBe(1);
    expect(result.current.question?.id).toBe(101);
    expect(result.current.total).toBe(3);
    const s = useSessionStore.getState();
    expect(s.attemptId).toBe(ATTEMPT_ID);
    expect(s.status).toBe('inProgress');
  });

  test('submit → feedback with the server verdict; payload matches the contract', async () => {
    answerQueue.push(correctAnswer({ combo: 1 }));
    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('question'));

    await actAsync(() => result.current.submit([1]));
    await waitFor(() => expect(result.current.phase).toBe('feedback'));

    expect(result.current.lastAnswer?.is_correct).toBe(true);
    expect(result.current.combo).toBe(1);

    const answerPost = requests.find((r) => r.url === ENDPOINTS.attemptAnswers(ATTEMPT_ID));
    expect(answerPost?.body).toMatchObject({
      question_id: 101,
      selected_choice_ids: [1],
    });
    expect((answerPost?.body as { time_ms: number }).time_ms).toBeGreaterThanOrEqual(0);
  });

  test('feedback → next question; the answered question NEVER reappears', async () => {
    answerQueue.push(wrongAnswer({ combo: 0 }));
    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('question'));

    await actAsync(() => result.current.submit([2]));
    await waitFor(() => expect(result.current.phase).toBe('feedback'));

    await actAsync(() => result.current.continueNext());
    expect(result.current.phase).toBe('question');
    // Wrong answer does NOT re-queue (PLAN decision 4): index moves forward.
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.question?.id).toBe(102);
    expect(useSessionStore.getState().answers[101]).toBeTruthy();
  });

  test('combo increments on correct answers and resets on wrong (server-mirrored)', async () => {
    answerQueue.push(
      correctAnswer({ combo: 1 }),
      correctAnswer({ combo: 2 }),
      wrongAnswer({ combo: 0 }),
    );
    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('question'));

    await actAsync(() => result.current.submit([1]));
    await waitFor(() => expect(result.current.combo).toBe(1));
    await actAsync(() => result.current.continueNext());

    await actAsync(() => result.current.submit([4, 6]));
    await waitFor(() => expect(result.current.combo).toBe(2));
    await actAsync(() => result.current.continueNext());

    await actAsync(() => result.current.submit([8]));
    await waitFor(() => expect(result.current.phase).toBe('feedback'));
    expect(result.current.combo).toBe(0);
    expect(useSessionStore.getState().maxCombo).toBe(2);
  });

  test('hearts hitting 0 mid-session fires onHeartsDepleted (non-blocking)', async () => {
    const onHeartsDepleted = jest.fn();
    answerQueue.push(wrongAnswer({ hearts_remaining: 0 }));
    const { result } = await renderEngine({ onHeartsDepleted });
    await waitFor(() => expect(result.current.phase).toBe('question'));

    await actAsync(() => result.current.submit([3]));
    await waitFor(() => expect(result.current.phase).toBe('feedback'));

    expect(onHeartsDepleted).toHaveBeenCalledTimes(1);
    expect(result.current.heartsRemaining).toBe(0);
    // The session continues — feedback then next question, no blocking state.
    await actAsync(() => result.current.continueNext());
    expect(result.current.phase).toBe('question');
  });

  test('last question → completing → done with the results payload stored', async () => {
    answerQueue.push(
      correctAnswer({ combo: 1 }),
      correctAnswer({ combo: 2 }),
      wrongAnswer({ combo: 0 }),
    );
    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('question'));

    for (let i = 0; i < 3; i += 1) {
      const choiceId = result.current.question!.choices[0].id;
      await actAsync(() => result.current.submit([choiceId]));
      await waitFor(() => expect(result.current.phase).toBe('feedback'));
      await actAsync(() => result.current.continueNext());
    }

    await waitFor(() => expect(result.current.phase).toBe('done'));
    const s = useSessionStore.getState();
    expect(s.status).toBe('completed');
    expect(s.results?.stars).toBe(completeResponse.stars);
    expect(requests.some((r) => r.url === ENDPOINTS.attemptComplete(ATTEMPT_ID))).toBe(true);
  });

  test('crash recovery: a matching persisted attempt resumes WITHOUT a new start call', async () => {
    useSessionStore.getState().startSession({
      attemptId: ATTEMPT_ID,
      levelId: LEVEL_ID,
      questions: startAttemptResponse.questions,
    });
    useSessionStore.getState().recordAnswer(101, [1], correctAnswer({ combo: 1 }));
    useSessionStore.getState().advance();

    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('question'));

    expect(startCalls()).toBe(0); // resumed, not restarted
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.question?.id).toBe(102);
    expect(result.current.combo).toBe(1);
  });

  test('crash recovery: crashed during feedback (answered but not advanced) skips ahead', async () => {
    useSessionStore.getState().startSession({
      attemptId: ATTEMPT_ID,
      levelId: LEVEL_ID,
      questions: startAttemptResponse.questions,
    });
    // Answer recorded, but the app died before advance() — currentIndex still 0.
    useSessionStore.getState().recordAnswer(101, [2], wrongAnswer({ combo: 0 }));

    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('question'));

    expect(result.current.currentIndex).toBe(1); // auto-skipped the answered one
    expect(result.current.question?.id).toBe(102);
    expect(startCalls()).toBe(0);
  });

  test('crash recovery: all questions answered → completes immediately', async () => {
    useSessionStore.getState().startSession({
      attemptId: ATTEMPT_ID,
      levelId: LEVEL_ID,
      questions: startAttemptResponse.questions,
    });
    const store = useSessionStore.getState();
    store.recordAnswer(101, [1], correctAnswer({ combo: 1 }));
    store.recordAnswer(102, [4], correctAnswer({ combo: 2 }));
    store.recordAnswer(103, [8], correctAnswer({ combo: 3 }));

    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('done'));

    expect(startCalls()).toBe(0);
    expect(useSessionStore.getState().results).not.toBeNull();
  });

  test('start failure surfaces the coded error (409 out_of_hearts → phase error)', async () => {
    api.defaults.adapter = async (config) => {
      const url = config.url ?? '';
      if (url === ENDPOINTS.levelAttempts(LEVEL_ID)) {
        throw codedError(config, 409, { code: 'out_of_hearts', detail: 'Plus de cœurs' });
      }
      throw new Error(`unexpected request ${url}`);
    };

    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.startError?.code).toBe('out_of_hearts');
    expect(result.current.startError?.status).toBe(409);
  });

  test('answers map integrity: every verdict lands under its question id', async () => {
    answerQueue.push(correctAnswer({ combo: 1 }), wrongAnswer({ combo: 0 }));
    const { result } = await renderEngine();
    await waitFor(() => expect(result.current.phase).toBe('question'));

    await actAsync(() => result.current.submit([1]));
    await waitFor(() => expect(result.current.phase).toBe('feedback'));
    await actAsync(() => result.current.continueNext());

    await actAsync(() => result.current.submit([5, 7]));
    await waitFor(() => expect(result.current.phase).toBe('feedback'));

    expect(useSessionStore.getState().answers).toEqual({
      101: { selected: [1], is_correct: true },
      102: { selected: [5, 7], is_correct: false },
    });
  });
});
