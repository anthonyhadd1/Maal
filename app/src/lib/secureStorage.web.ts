/**
 * Token storage adapter (web build — DEMO ONLY).
 *
 * expo-secure-store has no web implementation (its web module is an empty
 * stub), so the browser demo persists tokens in localStorage. Mirrors the
 * async surface of `secureStorage.ts` exactly. Guarded so environments
 * without localStorage (SSR pass) degrade to in-memory nulls instead of
 * crashing.
 */

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  return storage()?.getItem(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  storage()?.setItem(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  storage()?.removeItem(key);
}
