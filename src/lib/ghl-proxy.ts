import { getLocationAccessToken } from './ghl';

const GHL_API_URL = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export type GhlProxyResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function callGhl<T>(
  locationId: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<GhlProxyResult<T>> {
  let token: string;
  try {
    token = await getLocationAccessToken(locationId);
  } catch (e) {
    return { ok: false, status: 401, error: e instanceof Error ? e.message : 'Auth failed' };
  }

  const res = await fetch(`${GHL_API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      Version: GHL_VERSION,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { rawText: text };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof data === 'object' && data && 'message' in data ? String((data as any).message) : `GHL error ${res.status}`,
    };
  }

  return { ok: true, data: data as T };
}

export const ghlGet = <T = unknown>(locationId: string, path: string) => callGhl<T>(locationId, 'GET', path);
export const ghlPost = <T = unknown>(locationId: string, path: string, body: unknown) =>
  callGhl<T>(locationId, 'POST', path, body);
