import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { gemini } from '@/lib/gemini';
import { InboundJob, Agent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Buscar o próximo job pendente
    const { data: job, error: jobError } = await supabase
      .from('inbound_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ message: 'No pending jobs' }, { status: 200 });
    }

    console.log(`Processing job ${job.id} for message ${job.message_id}`);

    // Atualizar status para processing
    await supabase
      .from('inbound_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id);

    // Buscar agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', job.agent_id)
      .single();

    if (agentError || !agent) {
      throw new Error('Agent not found');
    }

    // Buscar contexto da knowledge base (RAG)
    const context = await retrieveContext(job.message_text, job.knowledge_base_ids, job.agent_id);

    // Gerar system prompt
    const systemPrompt = generateSystemPrompt(agent);

    // Preparar mensagens para o Gemini
    const messages = [{
      role: 'user' as const,
      parts: job.message_text
    }];

    // Gerar resposta com RAG
    const { response: generatedResponse } = await gemini.generateWithRAG({
      messages,
      systemInstruction: systemPrompt,
      context: context.map(c => c.content),
      temperature: 0.7,
    });

    const processingTime = Date.now() - startTime;

    // Atualizar job com resposta
    const { error: updateError } = await supabase
      .from('inbound_jobs')
      .update({
        status: 'completed',
        response_text: generatedResponse,
        context_sources: context,
        processing_time_ms: processingTime,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    if (updateError) {
      console.error('Error updating job:', updateError);
    }

    await sendMessageToGHL(job.contact_id, generatedResponse, job.location_id, job.message_type);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      response: generatedResponse,
      processingTime,
    });
  } catch (error) {
    console.error('Error processing inbound job:', error);

    // Atualizar job com erro
    const { data: latestJob } = await supabase
      .from('inbound_jobs')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestJob) {
      await supabase
        .from('inbound_jobs')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', latestJob.id);
    }

    return NextResponse.json(
      { error: 'Failed to process job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function retrieveContext(query: string, knowledgeBaseIds: string[], agentId: string): Promise<Array<{ content: string; source: string }>> {
  if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
    return [];
  }

  try {
    // Buscar FAQs relevantes
    const { data: faqs } = await supabase
      .from('faqs')
      .select('question, answer, id')
      .in('knowledge_base_id', knowledgeBaseIds)
      .limit(5);

    const faqContext = faqs?.map(faq => ({
      content: `Q: ${faq.question}\nA: ${faq.answer}`,
      source: `FAQ: ${faq.id}`
    })) || [];

    // Buscar chunks relevantes dos documentos
    // Por enquanto, buscar alguns chunks recentes como contexto
    const { data: chunks } = await supabase
      .from('chunks')
      .select('content, documents(url, title), id')
      .eq('agent_id', agentId)
      .limit(5)
      .order('created_at', { ascending: false });

    const chunksContext = chunks?.map(chunk => ({
      content: chunk.content,
      source: `Document: ${chunk.documents?.title || chunk.documents?.url || chunk.id}`
    })) || [];

    // Combinar e retornar
    return [...faqContext, ...chunksContext].slice(0, 5);
  } catch (error) {
    console.error('Error retrieving context:', error);
    return [];
  }
}

function generateSystemPrompt(agent: Agent): string {
  const parts: string[] = [];

  if (agent.personality) {
    parts.push(`PERSONALIDADE:\n${agent.personality}`);
  }

  if (agent.objective) {
    parts.push(`OBJETIVO:\n${agent.objective}`);
  }

  if (agent.additional_info) {
    parts.push(`INFORMAÇÕES ADICIONAIS:\n${agent.additional_info}`);
  }

  return parts.join('\n\n') || 'Você é um assistente profissional e prestativo.';
}

async function sendMessageToGHL(contactId: string, message: string, locationId: string, messageType: string) {
  const supabaseUrl = process.env.SUPABASE_URL!.replace('/rest/v1', '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE!;

  const response = await fetch(`${supabaseUrl}/functions/v1/ghl-send-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({
      contactId,
      locationId,
      message,
      messageType
    })
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Failed to send message to GHL:', error);
    throw new Error(`GHL send message failed: ${JSON.stringify(error)}`);
  }

  return await response.json();
}

