import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.jobId || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, status' },
        { status: 400 }
      );
    }

    const { jobId, status, error, meta } = body;

    // Update job status
    const updateData: any = {
      status,
      finished_at: new Date().toISOString()
    };

    if (error) {
      updateData.error = error;
    }

    if (meta) {
      updateData.meta = meta;
    }

    const { error: dbError } = await supabase
      .from('crawl_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to update job status' },
        { status: 500 }
      );
    }

    // If successful and we have documents data, save them
    if (status === 'success' && body.documents) {
      await saveDocuments(jobId, body.documents);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function saveDocuments(jobId: string, documents: any[]) {
  try {
    // Get job details to get source_id and knowledge_base_id
    const { data: job, error: jobError } = await supabase
      .from('crawl_jobs')
      .select(`
        source_id,
        kb_sources!inner(
          knowledge_base_id,
          knowledge_base:knowledge_bases(id)
        )
      `)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Failed to get job details:', jobError);
      return;
    }

    const kbSource = Array.isArray((job as any).kb_sources)
      ? (job as any).kb_sources[0]
      : (job as any).kb_sources;

    const knowledgeBaseId = kbSource?.knowledge_base?.id || kbSource?.knowledge_base_id;
    if (!knowledgeBaseId) {
      console.error('Knowledge base not found for job:', jobId);
      return;
    }

    const { chunkText, estimateTokenCount } = await import('@/lib/chunking');

    for (const doc of documents) {
      try {
        const contentHash = generateHash(doc.content);
        
        // Check for duplicate
        const { data: existingItems } = await supabase
          .from('knowledge_items')
          .select('id')
          .eq('content_type', 'document')
          .eq('metadata->>hash', contentHash)
          .limit(1);

        if (existingItems && existingItems.length > 0) {
          console.log('Document already exists, skipping:', doc.url);
          continue;
        }

        // Create chunks
        const chunks = chunkText(doc.content, { chunkSize: 1000, overlap: 200 });
        
        if (chunks.length === 0) {
          console.warn('No chunks generated for document:', doc.url);
          continue;
        }

        // Save document as knowledge_item
        const documentItem = {
          knowledge_base_id: knowledgeBaseId,
          content_type: 'document' as const,
          content: doc.content,
          title: doc.title,
          url: doc.url,
          metadata: {
            hash: contentHash,
            source_id: job.source_id,
            job_id: jobId,
            chunk_count: chunks.length
          },
          token_count: estimateTokenCount(doc.content)
        };

        const { data: savedDocument, error: docError } = await supabase
          .from('knowledge_items')
          .insert([documentItem])
          .select('id')
          .single();

        if (docError) {
          console.error('Error creating document:', docError);
          continue;
        }

        // Save chunks as knowledge_items with embeddings
        console.log(`🔮 Gerando embeddings para ${chunks.length} chunks...`);
        
        const chunkInserts = await Promise.all(
          chunks.map(async (chunkContent, index) => {
            let embedding: number[] | null = null;
            
            try {
              embedding = await generateEmbedding(chunkContent);
              console.log(`✅ Embedding gerado para chunk ${index + 1}/${chunks.length}`);
            } catch (error) {
              console.error(`❌ Erro ao gerar embedding para chunk ${index + 1}:`, error);
            }

            return {
              knowledge_base_id: knowledgeBaseId,
              content_type: 'chunk' as const,
              content: chunkContent,
              title: `${doc.title} (Parte ${index + 1})`,
              url: doc.url,
              embedding: embedding || null,
              metadata: {
                document_id: savedDocument.id,
                position: index,
                source_id: job.source_id,
                job_id: jobId
              },
              source_entity_id: savedDocument.id,
              source_entity_type: 'document' as const,
              token_count: estimateTokenCount(chunkContent)
            };
          })
        );

        const { error: chunksError } = await supabase
          .from('knowledge_items')
          .insert(chunkInserts);

        if (chunksError) {
          console.error('Error creating chunks:', chunksError);
        } else {
          const chunksWithEmbeddings = chunkInserts.filter(c => c.embedding !== null).length;
          console.log(`✅ Documento e ${chunks.length} chunks salvos (${chunksWithEmbeddings} com embeddings) para:`, doc.url);
        }
      } catch (error) {
        console.error('Error processing document:', error);
      }
    }
  } catch (error) {
    console.error('Error saving documents:', error);
  }
}

function generateHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
