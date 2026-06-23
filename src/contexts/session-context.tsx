'use client';

// Client-side session for the embedded iframe UI.
//
// The trust anchor is the GHL SSO handshake: postMessage -> /api/ghl/decrypt
// returns a signed sessionToken bound to the location. We attach it as
// `Authorization: Bearer` on every same-origin /api/* request.
//
// IMPORTANT: the fetch interceptor is installed at MODULE IMPORT time, not in a
// React effect. React runs effects bottom-up (children before parents), so a
// provider effect cannot beat a child component's data-fetch effect — an earlier
// design installed the patch in an effect and the very first agent fetch went out
// unpatched (no token, no retry) and 401'd. Installing at import guarantees the
// patch is active before any component renders or fetches.
//
// Bearer token (not cookie) on purpose: third-party cookies in a cross-site
// iframe are blocked by Safari/Chrome; Authorization headers are not.

import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { getGHLUserData, type GHLUserData } from '@/lib/ghl-user-data';

const STORAGE_KEY = 'homio_session_token';

// ---- Module-level auth state (independent of React lifecycle) ----
let currentToken: string | null = null;
let lastUserData: GHLUserData | null = null;
let ready = false;
let inflight: Promise<string | null> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function readCache(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeCache(t: string | null) {
  try {
    if (t) sessionStorage.setItem(STORAGE_KEY, t);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sessionStorage may be unavailable; in-memory token still works */
  }
}

/** Runs the SSO handshake once (deduped) and caches the resulting token. */
export function runHandshake(): Promise<string | null> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const data = await getGHLUserData();
      lastUserData = data;
      currentToken = data.sessionToken ?? null;
      writeCache(currentToken);
      return currentToken;
    } catch {
      // Not in iframe / GHL didn't respond — keep whatever we had.
      return currentToken;
    } finally {
      ready = true;
      inflight = null;
      notify();
    }
  })();
  return inflight;
}

function isApiUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function installInterceptor() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __homioFetchPatched?: boolean };
  if (w.__homioFetchPatched) return;
  w.__homioFetchPatched = true;

  // Rehydrate any cached token synchronously so the first call can carry it.
  currentToken = readCache();

  const orig = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (!isApiUrl(url)) return orig(input, init);

    // The decrypt endpoint mints the token; never gate it on a token.
    const isDecrypt = url.includes('/api/ghl/decrypt');

    const baseHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    const build = (token: string | null): RequestInit => {
      const headers = new Headers(baseHeaders);
      if (token && !isDecrypt) headers.set('Authorization', `Bearer ${token}`);
      return { ...init, headers };
    };

    // Ensure a token exists before the first protected call.
    let token = currentToken;
    if (!token && !isDecrypt) token = await runHandshake();

    let res = await orig(input, build(token));

    // On 401, the token is stale/absent — re-mint once and retry.
    if (res.status === 401 && !isDecrypt) {
      currentToken = null;
      const fresh = await runHandshake();
      if (fresh) res = await orig(input, build(fresh));
    }
    return res;
  };
}

// Install immediately at import — before any component renders/fetches.
installInterceptor();

// ---- React surface (optional; for UI that wants session info) ----

type SessionSnapshot = {
  sessionToken: string | null;
  locationId: string | null;
  userData: GHLUserData | null;
  ready: boolean;
};

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let cachedSnapshot: SessionSnapshot = {
  sessionToken: null,
  locationId: null,
  userData: null,
  ready: false,
};

function getSnapshot(): SessionSnapshot {
  // Recompute only when something changed, so useSyncExternalStore stays stable.
  if (
    cachedSnapshot.sessionToken !== currentToken ||
    cachedSnapshot.userData !== lastUserData ||
    cachedSnapshot.ready !== ready
  ) {
    cachedSnapshot = {
      sessionToken: currentToken,
      locationId: lastUserData?.activeLocation ?? null,
      userData: lastUserData,
      ready,
    };
  }
  return cachedSnapshot;
}

const serverSnapshot: SessionSnapshot = {
  sessionToken: null,
  locationId: null,
  userData: null,
  ready: false,
};

export function useSession() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const refresh = useCallback(() => {
    currentToken = null;
    return runHandshake();
  }, []);
  return { ...snap, refresh, apiFetch: fetch };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Warm up the handshake so UI (and the cached token) is ready early, even on
  // routes that don't immediately hit /api. The interceptor also triggers it
  // lazily, so this is just a warm-up.
  if (typeof window !== 'undefined' && !ready && !inflight) {
    void runHandshake();
  }
  return <>{children}</>;
}
