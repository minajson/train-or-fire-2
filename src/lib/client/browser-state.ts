"use client";

import { useSyncExternalStore } from "react";

/**
 * Reading browser-only state (localStorage, `window.location`) without a
 * hydration mismatch and without a setState-in-effect.
 *
 * The obvious version — `useEffect(() => setX(localStorage.getItem(k)))` —
 * works, but costs an extra render pass on every mount. `useSyncExternalStore`
 * is the primitive built for exactly this: the server snapshot during SSR, the
 * real value from the first client render onward.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab writing the same key still counts as a change.
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Notifies same-tab readers, which the `storage` event deliberately does not. */
function emit() {
  for (const listener of listeners) listener();
}

export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing with storage disabled.
    return null;
  }
}

export function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore — the session still works for this page load */
  }
  emit();
}

export function removeStored(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  emit();
}

/** `null` during SSR and on the very first paint, then the stored value. */
export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readStored(key),
    () => null,
  );
}

const noopSubscribe = () => () => {};

/** The page's origin — empty string during SSR, real value on the client. */
export function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}

/** True once the client has taken over from the server-rendered markup. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
