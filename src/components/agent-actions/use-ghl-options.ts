'use client';

import { useEffect, useMemo, useState } from 'react';

export type GhlOption = {
  id: string;
  label: string;
  sublabel?: string;
  // Campos extras retornados pela API (ex: dataType em custom-fields).
  [key: string]: unknown;
};

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: GhlOption[] }
  | { status: 'error'; message: string };

// Cache simples por sessao (compartilhado entre instancias de GhlSelect).
// Chave = endpoint completo (com locationId). Limpa quando a aba fecha.
const cache = new Map<string, GhlOption[]>();
const inflight = new Map<string, Promise<GhlOption[]>>();

async function fetchOptions(endpoint: string): Promise<GhlOption[]> {
  if (cache.has(endpoint)) return cache.get(endpoint)!;
  if (inflight.has(endpoint)) return inflight.get(endpoint)!;

  const promise = (async () => {
    const res = await fetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const json = await res.json();
    const items: GhlOption[] = Array.isArray(json.items) ? json.items : [];
    cache.set(endpoint, items);
    return items;
  })();

  inflight.set(endpoint, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(endpoint);
  }
}

/**
 * Carrega opcoes de um endpoint /api/ghl/* com cache de sessao.
 *
 * @param resource o segmento do endpoint (ex: 'workflows', 'calendars')
 * @param locationId locationId da subconta GHL
 * @param extraParams query params adicionais (ex: { model: 'contact' } pra custom-fields)
 */
export function useGhlOptions(
  resource: string,
  locationId: string | undefined,
  extraParams?: Record<string, string>,
): State & { reload: () => void } {
  const endpoint = useMemo(() => {
    if (!locationId) return null;
    const params = new URLSearchParams({ locationId, ...(extraParams ?? {}) });
    return `/api/ghl/${resource}?${params.toString()}`;
  }, [resource, locationId, extraParams]);

  const [state, setState] = useState<State>({ status: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!endpoint) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    fetchOptions(endpoint)
      .then((items) => {
        if (cancelled) return;
        setState({ status: 'ready', items });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setState({ status: 'error', message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, reloadKey]);

  const reload = () => {
    if (endpoint) cache.delete(endpoint);
    setReloadKey((k) => k + 1);
  };

  return { ...state, reload };
}

export function invalidateGhlOptions(resource: string, locationId: string, extraParams?: Record<string, string>) {
  const params = new URLSearchParams({ locationId, ...(extraParams ?? {}) });
  cache.delete(`/api/ghl/${resource}?${params.toString()}`);
}
