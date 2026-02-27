import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const faqId = params.id;
    const body = await request.json();

    if (!faqId) {
      return NextResponse.json(
        { error: 'FAQ ID is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.question || !body.answer) {
      return NextResponse.json(
        { error: 'Missing required fields: question, answer' },
        { status: 400 }
      );
    }

    const faqContent = `Q: ${body.question}\nA: ${body.answer}`;

    // Update FAQ in knowledge_items
    const { data, error } = await supabase
      .from('knowledge_items')
      .update({
        content: faqContent,
        title: body.question,
        metadata: {
          question: body.question,
          answer: body.answer
        },
        token_count: Math.ceil(faqContent.length / 4),
        updated_at: new Date().toISOString()
      })
      .eq('id', faqId)
      .eq('content_type', 'faq')
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'FAQ not found' },
          { status: 404 }
        );
      }
      
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update FAQ' },
        { status: 500 }
      );
    }

    const faq = {
      id: data.id,
      question: data.metadata?.question || data.title || '',
      answer: data.metadata?.answer || '',
      knowledge_base_id: data.knowledge_base_id,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

    return NextResponse.json(faq);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const faqId = params.id;

    if (!faqId) {
      return NextResponse.json(
        { error: 'FAQ ID is required' },
        { status: 400 }
      );
    }

    // Delete FAQ from knowledge_items
    const { error } = await supabase
      .from('knowledge_items')
      .delete()
      .eq('id', faqId)
      .eq('content_type', 'faq');

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete FAQ' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

