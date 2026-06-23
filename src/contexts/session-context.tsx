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

  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
      const withAuth = (token: string | null): RequestInit => {
        const headers = new Headers(init.headers || {});
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return { ...init, headers };
      };

      let res = await fetch(input, withAuth(tokenRef.current));

      // On 401, re-run the handshake once and retry with a fresh token.
      if (res.status === 401) {
        const fresh = await runHandshake();
        if (fresh && fresh !== tokenRef.current) {
          // runHandshake already stored it; tokenRef is current.
        }
        if (tokenRef.current) {
          res = await fetch(input, withAuth(tokenRef.current));
        }
      }
      return res;
    },
    [runHandshake]
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
