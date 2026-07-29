import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { authApi } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { ToastProvider } from '@/components/feedback/Toast';
import { ForgotPasswordScreen } from '@/features/auth/ForgotPasswordScreen';
import '@/i18n';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// expo-router: capture navigation so we can assert the post-reset redirect.
// (jest.mock is hoisted above the imports above, so the screen picks this up.)
const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  router: { replace: jest.fn(), dismissTo: jest.fn() },
}));

type Adapter = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}
function coded(config: InternalAxiosRequestConfig, status: number, body: unknown): AxiosError {
  const response: AxiosResponse = { data: body, status, statusText: 'Error', headers: {}, config };
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, undefined, response);
}

let requests: { url: string; body: Record<string, unknown> }[] = [];
let confirmStatus: { status: number; body: unknown } = { status: 200, body: { detail: 'ok' } };
let originalAdapter: unknown;

/** Contract-faithful fake of the two recovery endpoints. */
const fakeBackend: Adapter = async (config) => {
  const url = config.url ?? '';
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {});
  requests.push({ url, body });
  if (url === ENDPOINTS.authPasswordReset) {
    return ok(config, { detail: 'Si un compte existe, un code a été envoyé.' });
  }
  if (url === ENDPOINTS.authPasswordResetConfirm) {
    if (confirmStatus.status !== 200) throw coded(config, confirmStatus.status, confirmStatus.body);
    return ok(config, confirmStatus.body);
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

/** Drive a controlled RN TextInput + button, flushing state inside act(). */
async function press(fn: () => void): Promise<void> {
  await act(async () => {
    fn();
  });
}

beforeEach(() => {
  requests = [];
  confirmStatus = { status: 200, body: { detail: 'Mot de passe réinitialisé.' } };
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  originalAdapter = authApi.defaults.adapter;
  authApi.defaults.adapter = fakeBackend as never;
});

afterEach(() => {
  authApi.defaults.adapter = originalAdapter as never;
});

describe('ForgotPasswordScreen — two-step recovery', () => {
  test('requesting a code advances to step 2 and normalizes the email', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ForgotPasswordScreen />
      </Wrapper>,
    );

    await press(() => fireEvent.changeText(getByTestId('forgot-email'), 'User@Example.COM'));
    await press(() => fireEvent.press(getByTestId('forgot-send-code')));

    await waitFor(() => expect(getByTestId('forgot-code')).toBeTruthy());
    const req = requests.find((r) => r.url === ENDPOINTS.authPasswordReset);
    expect(req).toBeTruthy();
    // Email is trimmed + lowercased before it leaves the client.
    expect(req?.body.email).toBe('user@example.com');
    // Step-2 controls are present.
    expect(getByTestId('forgot-sent-banner')).toBeTruthy();
    expect(getByTestId('forgot-new-password')).toBeTruthy();
  });

  test('submitting the code + new password confirms and redirects to login', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ForgotPasswordScreen />
      </Wrapper>,
    );

    await press(() => fireEvent.changeText(getByTestId('forgot-email'), 'rania@example.com'));
    await press(() => fireEvent.press(getByTestId('forgot-send-code')));
    await waitFor(() => expect(getByTestId('forgot-code')).toBeTruthy());

    await press(() => {
      fireEvent.changeText(getByTestId('forgot-code'), '123456');
      fireEvent.changeText(getByTestId('forgot-new-password'), 'F3sh!newpass');
    });
    await press(() => fireEvent.press(getByTestId('forgot-submit')));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/login'));
    const confirm = requests.find((r) => r.url === ENDPOINTS.authPasswordResetConfirm);
    expect(confirm?.body).toMatchObject({
      email: 'rania@example.com',
      code: '123456',
      new_password: 'F3sh!newpass',
    });
  });

  test('an invalid code keeps the user on step 2 and does not redirect', async () => {
    confirmStatus = { status: 400, body: { detail: 'Code invalide ou expiré.' } };
    const { getByTestId } = await render(
      <Wrapper>
        <ForgotPasswordScreen />
      </Wrapper>,
    );

    await press(() => fireEvent.changeText(getByTestId('forgot-email'), 'x@example.com'));
    await press(() => fireEvent.press(getByTestId('forgot-send-code')));
    await waitFor(() => expect(getByTestId('forgot-code')).toBeTruthy());

    await press(() => {
      fireEvent.changeText(getByTestId('forgot-code'), '000000');
      fireEvent.changeText(getByTestId('forgot-new-password'), 'F3sh!newpass');
    });
    await press(() => fireEvent.press(getByTestId('forgot-submit')));

    await waitFor(() =>
      expect(requests.some((r) => r.url === ENDPOINTS.authPasswordResetConfirm)).toBe(true),
    );
    expect(mockRouter.replace).not.toHaveBeenCalled();
    // Still on step 2 — the code field is still mounted.
    expect(getByTestId('forgot-code')).toBeTruthy();
  });

  test('empty email is blocked client-side (no request fired)', async () => {
    const { getByTestId } = await render(
      <Wrapper>
        <ForgotPasswordScreen />
      </Wrapper>,
    );
    await press(() => fireEvent.press(getByTestId('forgot-send-code')));
    expect(requests.length).toBe(0);
    // Still on step 1.
    expect(getByTestId('forgot-email')).toBeTruthy();
  });
});
