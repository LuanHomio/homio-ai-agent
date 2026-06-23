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

/** All knowledge_base ids belonging to a location (for scoping list queries). */
export async function kbIdsForLocation(locationUuid: string): Promise<string[]> {
  const { data } = await supabase
    .from('knowledge_bases')
    .select('id')
    .eq('location_id', locationUuid);
  return (data ?? []).map((r) => r.id as string);
}

/** All agent ids belonging to a location (for scoping list queries). */
export async function agentIdsForLocation(locationUuid: string): Promise<string[]> {
  const { data } = await supabase
    .from('agents')
    .select('id')
    .eq('location_id', locationUuid);
  return (data ?? []).map((r) => r.id as string);
}

/**
 * All kb_source ids belonging to a location — a source belongs if its KB or its
 * agent does. Used to scope unfiltered list endpoints (sources, documents,
 * crawl jobs) to the session's location. Returns [] for a location with none.
 */
export async function sourceIdsForLocation(locationUuid: string): Promise<string[]> {
  const [kbIds, agentIds] = await Promise.all([
    kbIdsForLocation(locationUuid),
    agentIdsForLocation(locationUuid),
  ]);
  const ids = new Set<string>();
  if (kbIds.length) {
    const { data } = await supabase
      .from('kb_sources')
      .select('id')
      .in('knowledge_base_id', kbIds);
    for (const r of data ?? []) ids.add(r.id as string);
  }
  if (agentIds.length) {
    const { data } = await supabase
      .from('kb_sources')
      .select('id')
      .in('agent_id', agentIds);
    for (const r of data ?? []) ids.add(r.id as string);
  }
  return Array.from(ids);
}

const notFound = (message = 'Not found') =>
  NextResponse.json({ error: message }, { status: 404 });

/**
 * Requires a valid session AND ownership of a kb_source. A source belongs to the
 * location if its knowledge_base (or, for legacy agent-scoped sources, its agent)
 * belongs to the location. Returns the auth context or a NextResponse.
 */
export async function requireSource(
  request: Request,
  sourceId: string
): Promise<LocationAuth | NextResponse> {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  const { data } = await supabase
    .from('kb_sources')
    .select('knowledge_base_id, agent_id')
    .eq('id', sourceId)
    .maybeSingle();
  if (!data) return notFound();
  const okKb = data.knowledge_base_id
    ? await kbInLocation(data.knowledge_base_id as string, auth.locationUuid)
    : false;
  const okAgent =
    !okKb && data.agent_id
      ? await agentInLocation(data.agent_id as string, auth.locationUuid)
      : false;
  if (!okKb && !okAgent) return notFound();
  return auth;
}

/**
 * Requires a valid session AND ownership of a knowledge_item (e.g. a FAQ),
 * resolved via its knowledge_base_id. Returns the auth context or a NextResponse.
 */
export async function requireKnowledgeItem(
  request: Request,
  itemId: string
): Promise<LocationAuth | NextResponse> {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  const { data } = await supabase
    .from('knowledge_items')
    .select('knowledge_base_id')
    .eq('id', itemId)
    .maybeSingle();
  if (!data?.knowledge_base_id) return notFound();
  if (!(await kbInLocation(data.knowledge_base_id as string, auth.locationUuid))) {
    return notFound();
  }
  return auth;
}

/**
 * Requires a valid session AND ownership of a crawl_job, resolved via its source
 * -> knowledge_base chain. Returns the auth context or a NextResponse.
 */
export async function requireCrawlJob(
  request: Request,
  jobId: string
): Promise<LocationAuth | NextResponse> {
  const auth = await requireLocation(request);
  if (auth instanceof NextResponse) return auth;
  const { data: job } = await supabase
    .from('crawl_jobs')
    .select('source_id')
    .eq('id', jobId)
    .maybeSingle();
  if (!job?.source_id) return notFound();
  // Reuse source ownership via a direct kb lookup off the source.
  const { data: src } = await supabase
    .from('kb_sources')
    .select('knowledge_base_id, agent_id')
    .eq('id', job.source_id as string)
    .maybeSingle();
  if (!src) return notFound();
  const okKb = src.knowledge_base_id
    ? await kbInLocation(src.knowledge_base_id as string, auth.locationUuid)
    : false;
  const okAgent =
    !okKb && src.agent_id
      ? await agentInLocation(src.agent_id as string, auth.locationUuid)
      : false;
  if (!okKb && !okAgent) return notFound();
  return auth;
}
