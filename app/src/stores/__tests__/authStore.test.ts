import * as SecureStore from 'expo-secure-store';

import {
  ACCESS_TOKEN_KEY,
  getAccessToken,
  REFRESH_TOKEN_KEY,
  setTokens,
} from '@/api/client';
import { queryClient } from '@/api/queryClient';
import { useAuthStore } from '@/stores/authStore';

describe('authStore', () => {
  beforeEach(async () => {
    (SecureStore as unknown as { __reset: () => void }).__reset();
    useAuthStore.setState({ status: 'boot' });
    queryClient.clear();
  });

  test('starts in boot status', () => {
    expect(useAuthStore.getState().status).toBe('boot');
  });

  test('bootstrap without stored tokens resolves to anon', async () => {
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('anon');
  });

  test('bootstrap with a stored refresh token resolves to authed and hydrates memory', async () => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, 'stored-access');
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, 'stored-refresh');

    await useAuthStore.getState().bootstrap();

    expect(useAuthStore.getState().status).toBe('authed');
    expect(getAccessToken()).toBe('stored-access');
  });

  test('setAuthed flips anon -> authed (login/register success path)', async () => {
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('anon');

    useAuthStore.getState().setAuthed();
    expect(useAuthStore.getState().status).toBe('authed');
  });

  test('logout purges tokens, clears the query cache and drops to anon', async () => {
    await setTokens({ access: 'a', refresh: 'r' });
    useAuthStore.getState().setAuthed();
    queryClient.setQueryData(['me'], { id: 1, username: 'rami' });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe('anon');
    expect(getAccessToken()).toBeNull();
    expect(await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)).toBeNull();
    expect(await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)).toBeNull();
    expect(queryClient.getQueryData(['me'])).toBeUndefined();
  });

  test('logout is idempotent', async () => {
    await useAuthStore.getState().logout();
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().status).toBe('anon');
  });
});
