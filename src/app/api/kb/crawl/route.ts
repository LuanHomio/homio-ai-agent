import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { CrawlRequest, CrawlResponse } from '@/lib/types';
import { crawlWithFirecrawl } from '@/lib/firecrawl';

export async function POST(request: NextRequest) {
  try {
    const body: CrawlRequest = await request.json();
    
    // Validate required fields
    if (!body.sourceId || !body.mode) {
      return NextResponse.json(
        { error: 'Missing required fields: sourceId, mode' },
        { status: 400 }
      );
    }

    // Validate mode
    if (!['direct', 'n8n'].includes(body.mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be: direct or n8n' },
        { status: 400 }
      );
    }

    // Get source details with agent_id
    const { data: source, error: sourceError } = await supabase
      .from('kb_sources')
      .select(`
        *,
        knowledge_base:knowledge_bases(
          id,
          agent_knowledge_bases(agent_id)
        )
      `)
      .eq('id', body.sourceId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    // Get agent_id from knowledge_base relationship
    const agentId = source.agent_id || source.knowledge_base?.agent_knowledge_bases?.[0]?.agent_id || null;

    // Check if there's already a job in progress for this source
    const { data: existingJob } = await supabase
      .from('crawl_jobs')
      .select('id, status, started_at, finished_at')
      .eq('source_id', body.sourceId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingJob) {
      return NextResponse.json(
        { 
          error: 'Já existe um crawl em andamento para esta fonte',
          jobId: existingJob.id,
          status: existingJob.status
        },
        { status: 409 }
      );
    }

    // Create crawl job
    const { data: job, error: jobError } = await supabase
      .from('crawl_jobs')
      .insert([{
        source_id: body.sourceId,
        agent_id: agentId,
        status: 'pending',
        meta: { mode: body.mode }
      }])
      .select()
      .single();

    if (jobError) {
      console.error('Database error:', jobError);
      return NextResponse.json(
        { error: 'Failed to create crawl job' },
        { status: 500 }
      );
    }

    // Start crawl based on mode
    if (body.mode === 'direct') {
      // Start direct crawl in background
      processDirectCrawl(job.id, source);
    } else {
      // Start n8n crawl
      await startN8nCrawl(job.id, source);
    }

    const response: CrawlResponse = {
      jobId: job.id
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processDirectCrawl(jobId: string, source: any) {
  try {
    // Update job status to running
    await supabase
      .from('crawl_jobs')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Fast path: try a quick scrape first to avoid slow/failed crawls
    try {
      const { scrapeWithFirecrawl } = await import('@/lib/firecrawl');
      const quickScrape = await scrapeWithFirecrawl(source.url);
      if (quickScrape?.success) {
        // Normalize structure
        const pageData = quickScrape.data?.data ? quickScrape.data.data : quickScrape.data;
        const contentLen = pageData?.markdown?.length || pageData?.content?.length || 0;
        if (contentLen >= 500) {
          let processedCount = 0;
          let errorCount = 0;
          try {
            await saveDocument(jobId, source.id, pageData);
            processedCount++;
          } catch (e) {
            errorCount++;
            console.error('❌ Erro ao salvar documento no quick scrape:', e);
          }

          await supabase
            .from('crawl_jobs')
            .update({
              status: 'success',
              finished_at: new Date().toISOString(),
              meta: {
                mode: 'direct',
                pagesProcessed: processedCount,
                errors: errorCount,
                scrapeFirst: true
              }
            })
            .eq('id', jobId);
          return; // Done, skip full crawl
        }
      }
    } catch (e) {
      // Ignore scrape preflight errors and fall through to crawl
    }

    // Perform crawl if quick scrape didn't produce usable content
    const crawlResult = await crawlWithFirecrawl({
      url: source.url,
      scope: source.scope,
      depth: source.depth
    });

    if (!crawlResult.success) {
      console.log('⚠️ Crawl falhou, tentando fallback com scrape...');
      
      // Try fallback with scrape for single page
      const { scrapeWithFirecrawl } = await import('@/lib/firecrawl');
      const scrapeResult = await scrapeWithFirecrawl(source.url);
      
      if (!scrapeResult.success) {
        console.log('❌ Fallback também falhou');
        // Update job with error
        await supabase
          .from('crawl_jobs')
          .update({
            status: 'error',
            finished_at: new Date().toISOString(),
            error: `Crawl failed: ${crawlResult.error}. Scrape fallback also failed: ${scrapeResult.error}`
          })
          .eq('id', jobId);
        return;
      }
      
      console.log('✅ Fallback com scrape funcionou!');
      console.log('📊 Estrutura do scrape result:', JSON.stringify(scrapeResult.data, null, 2));
      
      // Process scrape result as single page - handle different response structures
      let pageData;
      if (scrapeResult.data?.data) {
        // Structure: { data: { metadata: {...}, markdown: "..." } }
        pageData = scrapeResult.data.data;
      } else {
        // Structure: { metadata: {...}, markdown: "..." }
        pageData = scrapeResult.data;
      }
      
      console.log('📄 Page data para salvar:', {
        url: pageData?.metadata?.sourceURL || pageData?.url,
        title: pageData?.metadata?.title || pageData?.title,
        contentLength: pageData?.markdown?.length || pageData?.content?.length || 0
      });
      
      let processedCount = 0;
      let errorCount = 0;

      try {
        await saveDocument(jobId, source.id, pageData);
        processedCount++;
        console.log('✅ Documento salvo com sucesso no fallback');
      } catch (error) {
        console.error('❌ Erro ao salvar documento no fallback:', error);
        errorCount++;
      }

      // Update job with success (fallback)
      await supabase
        .from('crawl_jobs')
        .update({
          status: 'success',
          finished_at: new Date().toISOString(),
          meta: {
            mode: 'direct',
            pagesProcessed: processedCount,
            errors: errorCount,
            fallbackUsed: true,
            originalError: crawlResult.error
          }
        })
        .eq('id', jobId);
      return;
    }

    // Process and save documents
    console.log('📊 Estrutura da resposta do Firecrawl:', JSON.stringify(crawlResult.data, null, 2));
    
    let pages = [];
    
    // Handle different response structures
    if (crawlResult.data?.data) {
      // For crawl results
      pages = Array.isArray(crawlResult.data.data) ? crawlResult.data.data : [crawlResult.data.data];
    } else if (crawlResult.data) {
      // For single page results
      pages = [crawlResult.data];
    }
    
    console.log('📄 Páginas processadas:', pages.length);
    
    let processedCount = 0;
    let errorCount = 0;

    for (const page of pages) {
      try {
        await saveDocument(jobId, source.id, page);
        processedCount++;
      } catch (error) {
        console.error('Error saving document:', error);
        errorCount++;
      }
    }

    // Update job with success
    await supabase
      .from('crawl_jobs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        meta: {
          mode: 'direct',
          pagesProcessed: processedCount,
          errors: errorCount
        }
      })
      .eq('id', jobId);

  } catch (error) {
    console.error('Direct crawl error:', error);
    
    // Update job with error
    await supabase
      .from('crawl_jobs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', jobId);
  }
}

async function startN8nCrawl(jobId: string, source: any) {
  try {
    const webhookUrl = process.env.N8N_CRAWL_WEBHOOK;
    if (!webhookUrl) {
      throw new Error('N8N_CRAWL_WEBHOOK not configured');
    }

    const payload = {
      jobId,
      source: {
        url: source.url,
        scope: source.scope,
        depth: source.depth
      }
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`N8N webhook failed: ${response.status}`);
    }

    // Update job status to running
    await supabase
      .from('crawl_jobs')
      .update({ 
        status: 'running',
        started_at: new Date().toISOString()
      })
      .eq('id', jobId);

  } catch (error) {
    console.error('N8N crawl start error:', error);
    
    // Update job with error
    await supabase
      .from('crawl_jobs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', jobId);
  }
}

async function saveDocument(jobId: string, sourceId: string, page: any) {
  console.log('💾 Salvando documento:', {
    url: page.metadata?.sourceURL || page.url,
    title: page.metadata?.title || page.title,
    contentLength: page.markdown?.length || page.content?.length || 0,
    hasMarkdown: !!page.markdown,
    hasContent: !!page.content,
    hasMetadata: !!page.metadata
  });
  
  const { chunkText } = await import('@/lib/chunking');
  
  // Extract content from different possible structures
  const content = page.markdown || page.content || '';
  const url = page.metadata?.sourceURL || page.url || '';
  const title = page.metadata?.title || page.title || '';
  
  console.log('📋 Dados extraídos:', { contentLength: content.length, url, title });
  
  if (!content) {
    console.warn('⚠️ Documento sem conteúdo, pulando:', url);
    console.log('🔍 Estrutura da página:', JSON.stringify(page, null, 2));
    return;
  }
  
  if (content.length < 10) {
    console.warn('⚠️ Conteúdo muito pequeno, pulando:', url);
    return;
  }

  // Buscar agent_id da source
  const { data: source } = await supabase
    .from('kb_sources')
    .select(`
      agent_id,
      knowledge_base:knowledge_bases(
        id,
        agent_knowledge_bases(agent_id)
      )
    `)
    .eq('id', sourceId)
    .single();

  const agentId = source?.agent_id || source?.knowledge_base?.agent_knowledge_bases?.[0]?.agent_id || null;
  
  // Create document
  const { data: document, error: docError } = await supabase
    .from('documents')
    .insert([{
      source_id: sourceId,
      agent_id: agentId,
      job_id: jobId,
      url: url,
      title: title,
      content: content,
      hash: generateHash(content)
    }])
    .select()
    .single();

  if (docError) {
    // If document already exists (duplicate hash), skip
    if (docError.code === '23505') {
      console.log('📄 Documento já existe, pulando:', url);
      return;
    }
    console.error('❌ Erro ao salvar documento:', docError);
    throw docError;
  }

  console.log('✅ Documento salvo:', document.id);

  // Create chunks
  const chunks = chunkText(document.content, { chunkSize: 1000, overlap: 200 });
  
  if (chunks.length === 0) {
    console.warn('⚠️ Nenhum chunk gerado para o documento:', document.id);
    return;
  }
  
  const chunkInserts = chunks.map((content, index) => ({
    document_id: document.id,
    agent_id: agentId,
    position: index,
    content,
    token_count: estimateTokenCount(content)
  }));

  const { error: chunksError } = await supabase
    .from('chunks')
    .insert(chunkInserts);

  if (chunksError) {
    console.error('❌ Erro ao criar chunks:', chunksError);
  } else {
    console.log('✅ Chunks criados:', chunks.length);
  }
}

function generateHash(content: string): string {
  // Simple hash function for deduplication
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

