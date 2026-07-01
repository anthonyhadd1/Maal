import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

/** Offline-browsable domains (design_mobile.md §5): map, subjects, me, achievements. */
const PERSISTED_ROOT_KEYS = new Set(['subjects', 'map', 'me', 'achievements']);

export const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // gcTime must be >= persister maxAge for restored queries to survive.
      gcTime: PERSIST_MAX_AGE_MS,
      retry: 2,
    },
    mutations: {
      retry: 0,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'ace.queryCache',
  throttleTime: 1_000,
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: PERSIST_MAX_AGE_MS,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && PERSISTED_ROOT_KEYS.has(String(query.queryKey[0])),
  },
};
