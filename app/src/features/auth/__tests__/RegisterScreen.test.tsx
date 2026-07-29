import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { authApi } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { ToastProvider } from '@/components/feedback/Toast';
import { RegisterScreen } from '@/features/auth/RegisterScreen';
import { useAuthStore } from '@/stores/authStore';
import '@/i18n';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: { replace: jest.fn(), dismissTo: jest.fn() },
}));

type Adapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 201, statusText: 'Created', headers: {}, config };
}
function coded(config: InternalAxiosRequestConfig, status: number, body: unknown): AxiosError {
  const response: AxiosResponse = { data: body, status, statusText: 'Error', headers: {}, config };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response);
}

let requests: { url: string; body: Record<string, unknown> }[] = [];
let registerResult: { status: number; body: unknown } = { status: 201, body: {} };
let originalAdapter: unknown;

const fakeBackend: Adapter = async (config) => {
  const url = config.url ?? '';
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {});
  requests.push({ url, body });
  if (url === ENDPOINTS.authRegister) {
    if (registerResult.status !== 201) throw coded(config, registerResult.status, registerResult.body);
    return ok(config, registerResult.body);
  }
  throw new Error(`unexpected request ${url}`);
};

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: 0, gcTime: 0 } },
  });
  return (
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

async function press(fn: () => void): Promise<void> {
  await act(async () => {
    fn();
  });
}

const TOKENS = { access: 'a.b.c', refresh: 'd.e.f' };
const USER = { id: 1, username: 'newbie', email: 'new@example.com' };

beforeEach(() => {
  requests = [];
  registerResult = { status: 201, body: { user: USER, tokens: TOKENS } };
  mockRouter.replace.mockClear();
  useAuthStore.setState({ status: 'anon' });
  originalAdapter = authApi.defaults.adapter;
  authApi.defaults.adapter = fakeBackend as never;
});

afterEach(() => {
  authApi.defaults.adapter = originalAdapter as never;
});

function fillValidForm(getByTestId: (id: string) => unknown) {
  fireEvent.changeText(getByTestId('register-username') as never, 'newbie');
  fireEvent.changeText(getByTestId('register-email') as never, 'new@example.com');
  fireEvent.changeText(getByTestId('register-password') as never, 'S3cure!pass');
}

describe('RegisterScreen — email required + unique', () => {
  test('a valid submission registers and flips auth state to authed', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <RegisterScreen />
      </Wrapper>,
    );

    await press(() => fillValidForm(getByTestId));
    await press(() => fireEvent.press(getByTestId('register-submit')));

    await waitFor(() => expect(useAuthStore.getState().status).toBe('authed'));
    const req = requests.find((r) => r.url === ENDPOINTS.authRegister);
    expect(req?.body).toMatchObject({ username: 'newbie', email: 'new@example.com' });
  });

  test('a duplicate-email 400 surfaces the error on the email field, no auth', async () => {
    registerResult = {
      status: 400,
      body: { email: ['Un compte existe déjà avec cette adresse e-mail.'] },
    };
    const { getByTestId, findByText } = await render(
      <Wrapper>
        <RegisterScreen />
      </Wrapper>,
    );

    await press(() => fillValidForm(getByTestId));
    await press(() => fireEvent.press(getByTestId('register-submit')));

    // The server's field error is shown inline (below the email input).
    expect(await findByText('Un compte existe déjà avec cette adresse e-mail.')).toBeTruthy();
    expect(useAuthStore.getState().status).toBe('anon');
  });

  test('a missing email is blocked client-side (email is required, no request)', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <RegisterScreen />
      </Wrapper>,
    );

    // Everything but email.
    await press(() => {
      fireEvent.changeText(getByTestId('register-username'), 'newbie');
      fireEvent.changeText(getByTestId('register-password'), 'S3cure!pass');
    });
    await press(() => fireEvent.press(getByTestId('register-submit')));

    expect(requests.length).toBe(0);
    expect(useAuthStore.getState().status).toBe('anon');
  });
});
