'use client';

// Client-side session for the embedded iframe UI.
//
// On mount (any route, since the app always runs inside the GHL iframe) we run
// the SSO handshake once: postMessage -> /api/ghl/decrypt -> signed sessionToken
// bound to the location. The token is kept in memory + sessionStorage and sent
// as `Authorization: Bearer` on every API call via `apiFetch`.
//
// During rollout the server only logs missing/invalid sessions; it does not yet
// reject. Once enforcement lands, callers should await `ready` before fetching.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getGHLUserData, type GHLUserData } from '@/lib/ghl-user-data';

const STORAGE_KEY = 'homio_session_token';

type SessionContextValue = {
  /** Current signed session token, or null if the handshake hasn't completed. */
  sessionToken: string | null;
  /** locationId proven by the session (from activeLocation). */
  locationId: string | null;
  userData: GHLUserData | null;
  /** true once the handshake settled (success or failure). */
  ready: boolean;
  error: string | null;
  /** Re-run the SSO handshake (e.g. after a 401). */
  refresh: () => Promise<string | null>;
  /** fetch wrapper that attaches the Bearer token and retries once on 401. */
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [userData, setUserData] = useState<GHLUserData | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest token in a ref so apiFetch reads it without being recreated.
  const tokenRef = useRef<string | null>(null);
  // Dedupe concurrent handshakes (multiple components fetching on first paint).
  const inflight = useRef<Promise<string | null> | null>(null);

  const setToken = useCallback((t: string | null) => {
    tokenRef.current = t;
    setSessionToken(t);
    try {
      if (t) sessionStorage.setItem(STORAGE_KEY, t);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* sessionStorage may be unavailable; in-memory token still works */
    }
  }, []);

  const runHandshake = useCallback((): Promise<string | null> => {
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        const data = await getGHLUserData();
        setUserData(data);
        if (data.activeLocation) setLocationId(data.activeLocation);
        const token = data.sessionToken ?? null;
        setToken(token);
        setError(token ? null : 'No session token returned');
        return token;
      } catch (e) {
        // Not in iframe / GHL didn't respond — leave unauthenticated.
        setError(e instanceof Error ? e.message : 'Session handshake failed');
        return null;
      } finally {
        setReady(true);
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, [setToken]);

  // Rehydrate from sessionStorage synchronously, then refresh in the background.
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        tokenRef.current = cached;
        setSessionToken(cached);
      }
    } catch {
      /* ignore */
    }
    runHandshake();
  }, [runHandshake]);

  // Global fetch interceptor: attach the Bearer token to every same-origin
  // /api/* request automatically, so we don't have to migrate each call site
  // (missing one would 401 and break the UI). Re-mints + retries once on 401.
  // Only touches /api/* — Next's RSC/navigation fetches (page routes) pass
  // through untouched.
  useEffect(() => {
    const orig = window.fetch;

    const isApiUrl = (url: string): boolean => {
      try {
        const u = new URL(url, window.location.origin);
        return u.origin === window.location.origin && u.pathname.startsWith('/api/');
      } catch {
        return false;
      }
    };

    const patched: typeof window.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (!isApiUrl(url)) return orig(input, init);

      const baseHeaders =
        init?.headers ?? (input instanceof Request ? input.headers : undefined);

      const withToken = (token: string | null): RequestInit => {
        const headers = new Headers(baseHeaders);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return { ...init, headers };
      };

      let res = await orig(input, withToken(tokenRef.current));
      if (res.status === 401) {
        const fresh = await runHandshake();
        if (fresh) res = await orig(input, withToken(fresh));
      }
      return res;
    };

    window.fetch = patched;
    return () => {
      window.fetch = orig;
    };
  }, [runHandshake]);

  // The global interceptor below already attaches the Bearer token and retries
  // on 401, so apiFetch just delegates to fetch. Kept as an explicit handle for
  // callers that prefer not to rely on the global patch.
  const apiFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => fetch(input, init),
    []
  );

  return (
    <SessionContext.Provider
      value={{
        sessionToken,
        locationId,
        userData,
        ready,
        error,
        refresh: runHandshake,
        apiFetch,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
