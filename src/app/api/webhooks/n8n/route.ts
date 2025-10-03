import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    // Get job details to get source_id
    const { data: job, error: jobError } = await supabase
      .from('crawl_jobs')
      .select('source_id')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      console.error('Failed to get job details:', jobError);
      return;
    }

    const { chunkText, estimateTokenCount } = await import('@/lib/chunking');

    for (const doc of documents) {
      try {
        // Create document
        const { data: document, error: docError } = await supabase
          .from('documents')
          .insert([{
            source_id: job.source_id,
            url: doc.url,
            title: doc.title,
            content: doc.content,
            hash: generateHash(doc.content)
          }])
          .select()
          .single();

        if (docError) {
          // If document already exists (duplicate hash), skip
          if (docError.code === '23505') {
            continue;
          }
          console.error('Error creating document:', docError);
          continue;
        }

        // Create chunks
        const chunks = chunkText(document.content, { chunkSize: 1000, overlap: 200 });
        
        const chunkInserts = chunks.map((content, index) => ({
          document_id: document.id,
          position: index,
          content,
          token_count: estimateTokenCount(content)
        }));

        const { error: chunksError } = await supabase
          .from('chunks')
          .insert(chunkInserts);

        if (chunksError) {
          console.error('Error creating chunks:', chunksError);
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
