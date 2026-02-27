import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const knowledgeBaseId = searchParams.get('knowledge_base_id');

    let query = supabase
      .from('knowledge_items')
      .select(`
        id,
        knowledge_base_id,
        content,
        metadata,
        title,
        created_at,
        updated_at,
        knowledge_base:knowledge_bases(id, name, location:locations(name))
      `)
      .eq('content_type', 'faq')
      .order('created_at', { ascending: false });

    if (knowledgeBaseId) {
      query = query.eq('knowledge_base_id', knowledgeBaseId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch FAQs' },
        { status: 500 }
      );
    }

    const faqs = data?.map(item => ({
      id: item.id,
      question: item.metadata?.question || item.title || '',
      answer: item.metadata?.answer || item.content || '',
      knowledge_base_id: item.knowledge_base_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
      knowledge_base: item.knowledge_base
    })) || [];

    return NextResponse.json(faqs);
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

    const faqContent = `Q: ${body.question}\nA: ${body.answer}`;

    // Insert FAQ as knowledge_item
    const { data, error } = await supabase
      .from('knowledge_items')
      .insert([{
        knowledge_base_id: body.knowledge_base_id,
        content_type: 'faq',
        content: faqContent,
        title: body.question,
        metadata: {
          question: body.question,
          answer: body.answer
        },
        token_count: Math.ceil(faqContent.length / 4)
      }])
      .select(`
        id,
        knowledge_base_id,
        content,
        metadata,
        title,
        created_at,
        updated_at,
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

    const faq = {
      id: data.id,
      question: data.metadata?.question || data.title || '',
      answer: data.metadata?.answer || '',
      knowledge_base_id: data.knowledge_base_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
      knowledge_base: data.knowledge_base
    };

    return NextResponse.json(faq, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

