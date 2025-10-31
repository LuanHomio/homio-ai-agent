import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const knowledgeBaseId = searchParams.get('knowledge_base_id');

    let query = supabase
      .from('faqs')
      .select(`
        *,
        knowledge_base:knowledge_bases(id, name, location:locations(name))
      `)
      .order('created_at', { ascending: false });

    if (knowledgeBaseId) {
      query = query.eq('knowledge_base_id', knowledgeBaseId);
    } else if (agentId) {
      // Fallback para compatibilidade
      query = query.eq('agent_id', agentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch FAQs' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.question || !body.answer || !body.knowledge_base_id) {
      return NextResponse.json(
        { error: 'Missing required fields: question, answer, knowledge_base_id' },
        { status: 400 }
      );
    }

    // Verify knowledge base exists and get agent_id
    const { data: kb, error: kbError } = await supabase
      .from('knowledge_bases')
      .select(`
        id, 
        location_id,
        agent_knowledge_bases(agent_id)
      `)
      .eq('id', body.knowledge_base_id)
      .single();

    if (kbError || !kb) {
      return NextResponse.json(
        { error: 'Knowledge base not found' },
        { status: 404 }
      );
    }

    // Get agent_id from knowledge_base relationship
    const agentId = body.agent_id || kb.agent_knowledge_bases?.[0]?.agent_id || null;

    // Insert FAQ
    const { data, error } = await supabase
      .from('faqs')
      .insert([{
        question: body.question,
        answer: body.answer,
        knowledge_base_id: body.knowledge_base_id,
        agent_id: agentId
      }])
      .select(`
        *,
        knowledge_base:knowledge_bases(id, name, location:locations(name))
      `)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to create FAQ' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

