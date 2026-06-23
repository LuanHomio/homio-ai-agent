// Authorization helpers for API routes.
//
// Every protected route resolves the caller's location FROM THE SIGNED SESSION
// (never from a query param / body, which the client can forge) and then checks
// that the requested resource belongs to that location. This closes the
// cross-tenant leak where any agentId/kbId in the URL returned another tenant's
// data.

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSessionFromRequest, type SessionClaims } from '@/lib/session';

export interface LocationAuth {
  session: SessionClaims;
  /** GHL location id (string) proven by the session. */
  ghlLocationId: string;
  /** Internal locations.id UUID for the session's location. */
  locationUuid: string;
}

export function unauthorized(message = 'unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Requires a valid session and resolves its location UUID. Returns either the
 * resolved auth context or a NextResponse to return immediately (401/403).
 *
 * Usage:
 *   const auth = await requireLocation(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { locationUuid, ghlLocationId } = auth;
 */
export async function requireLocation(request: Request): Promise<LocationAuth | NextResponse> {
  const session = getSessionFromRequest(request);
  if (!session) return unauthorized();

  const { data, error } = await supabase
    .from('locations')
    .select('id')
    .eq('ghl_location_id', session.loc)
    .maybeSingle();

  if (error || !data) {
    // Authenticated, but this location was never registered in our DB.
    return forbidden('location_not_registered');
  }

  return { session, ghlLocationId: session.loc, locationUuid: data.id };
}

/**
 * Requires a valid session AND that the given agent belongs to the session's
 * location. Returns the auth context or a NextResponse (401/403/404). Uses 404
 * for a cross-tenant agent so we don't leak whether it exists elsewhere.
 */
export async function requireAgent(
  request: Request,
  agentId: string
): Promise<LocationAuth | NextResponse> {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  if (!(await agentInLocation(agentId, auth.locationUuid))) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }
  return auth;
}

/**
 * Requires a valid session AND that the given knowledge base belongs to the
 * session's location. Returns the auth context or a NextResponse (401/403/404).
 */
export async function requireKb(
  request: Request,
  kbId: string
): Promise<LocationAuth | NextResponse> {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  if (!(await kbInLocation(kbId, auth.locationUuid))) {
    return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
  }
  return auth;
}

/** True if the agent exists and belongs to the given location UUID. */
export async function agentInLocation(agentId: string, locationUuid: string): Promise<boolean> {
  const { data } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('location_id', locationUuid)
    .maybeSingle();
  return !!data;
}

/** True if the knowledge base exists and belongs to the given location UUID. */
export async function kbInLocation(kbId: string, locationUuid: string): Promise<boolean> {
  const { data } = await supabase
    .from('knowledge_bases')
    .select('id')
    .eq('id', kbId)
    .eq('location_id', locationUuid)
    .maybeSingle();
  return !!data;
}
