// Session tokens for the embedded iframe UI.
//
// The trust anchor is the GHL SSO handshake: only GHL (holding GHL_SSO_KEY) can
// produce the encrypted token that /api/ghl/decrypt validates. At that single
// authenticated point we mint a short-lived signed session token bound to the
// caller's locationId. The browser then sends it as `Authorization: Bearer ...`
// on every API call, and routes verify it server-side.
//
// We use a Bearer token (not a cookie) on purpose: third-party cookies set by a
// cross-site iframe are blocked by Safari/Chrome, but Authorization headers are
// not. Signing uses node:crypto HMAC-SHA256 (compact JWT, HS256) — no extra deps.

import crypto from 'crypto';

// Distinct secret preferred; falls back to the SSO key so the feature works
// before SESSION_SECRET is provisioned. Set SESSION_SECRET in prod.
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.GHL_SSO_KEY ||
  '1bb0cf82-08cf-4ff7-8f59-2ae5ff7df6d1';

// 12h: long enough for a work session, short enough to bound a leaked token.
const DEFAULT_TTL_SECONDS = 12 * 60 * 60;

export interface SessionClaims {
  /** GHL userId */
  uid: string;
  /** GHL locationId (activeLocation) — the tenant boundary */
  loc: string;
  /** GHL companyId */
  cid?: string;
  /** GHL role (e.g. "admin"/"user") */
  role?: string;
  /** issued-at (epoch seconds) */
  iat: number;
  /** expiry (epoch seconds) */
  exp: number;
}

export type SessionInput = Omit<SessionClaims, 'iat' | 'exp'>;

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

function sign(data: string): string {
  return b64url(crypto.createHmac('sha256', SESSION_SECRET).update(data).digest());
}

/** Mints a compact HS256 token from the given claims. */
export function mintSessionToken(
  input: SessionInput,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: SessionClaims = {
    ...input,
    iat: now,
    exp: now + ttlSeconds,
  };
  const head = b64urlJson(header);
  const body = b64urlJson(payload);
  const sig = sign(`${head}.${body}`);
  return `${head}.${body}.${sig}`;
}

/**
 * Verifies a token's signature and expiry. Returns the claims on success,
 * or null on any failure (malformed, bad signature, expired). Never throws.
 */
export function verifySessionToken(token: string | null | undefined): SessionClaims | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;

  const expected = sign(`${head}.${body}`);
  // Timing-safe compare; lengths must match for timingSafeEqual.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  let claims: SessionClaims;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
  } catch {
    return null;
  }

  if (!claims || typeof claims.loc !== 'string' || !claims.loc) return null;
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp < now) return null;

  return claims;
}

/** Extracts a Bearer token from a request's Authorization header. */
export function bearerFromRequest(request: Request): string | null {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Resolves the session for a request from its Authorization: Bearer header.
 * Returns claims or null. Routes decide whether null means 401 (enforced) or
 * just "no session" (log-only during rollout).
 */
export function getSessionFromRequest(request: Request): SessionClaims | null {
  return verifySessionToken(bearerFromRequest(request));
}
