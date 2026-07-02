import * as SecureStore from 'expo-secure-store';

/**
 * Token storage adapter (native build).
 *
 * Thin passthrough to expo-secure-store — the native code path is IDENTICAL
 * to calling SecureStore directly. The web bundle resolves
 * `secureStorage.web.ts` instead (expo-secure-store has no web
 * implementation), which falls back to localStorage. Web is a DEMO-ONLY
 * surface; localStorage persistence there is an accepted tradeoff.
 */

export async function getItemAsync(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
