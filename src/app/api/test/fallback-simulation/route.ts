import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithFirecrawl } from '@/lib/firecrawl';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  console.log('🧪 Simulando fallback para debug');

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    console.log('🚀 Testando scrape diretamente...');
    const scrapeResult = await scrapeWithFirecrawl(url);
    
    console.log('📊 Resultado do scrape:', {
      success: scrapeResult.success,
      error: scrapeResult.error,
      dataStructure: scrapeResult.data ? Object.keys(scrapeResult.data) : null
    });

    if (!scrapeResult.success) {
      return NextResponse.json({
        success: false,
        error: scrapeResult.error,
        step: 'scrape_failed'
      });
    }

    // Simulate the saveDocument process
    let pageData;
    if (scrapeResult.data?.data) {
      pageData = scrapeResult.data.data;
    } else {
      pageData = scrapeResult.data;
    }

    console.log('📄 Page data structure:', {
      hasMarkdown: !!pageData?.markdown,
      hasContent: !!pageData?.content,
      hasMetadata: !!pageData?.metadata,
      markdownLength: pageData?.markdown?.length || 0,
      contentLength: pageData?.content?.length || 0,
      url: pageData?.metadata?.sourceURL || pageData?.url,
      title: pageData?.metadata?.title || pageData?.title
    });

    const content = pageData?.markdown || pageData?.content || '';
    const extractedUrl = pageData?.metadata?.sourceURL || pageData?.url || '';
    const title = pageData?.metadata?.title || pageData?.title || '';

    if (!content) {
      return NextResponse.json({
        success: false,
        error: 'No content found in scrape result',
        step: 'no_content',
        pageData
      });
    }

    // Try to create a test document
    const testDocument = {
      source_id: 'test-source',
      job_id: 'test-job',
      url: extractedUrl,
      title: title,
      content: content,
      hash: generateHash(content)
    };

    console.log('📝 Testando inserção no banco...');
    
    // Just test the structure, don't actually insert
    const response = {
      success: true,
      step: 'ready_to_save',
      documentStructure: testDocument,
      contentPreview: content.substring(0, 200) + '...',
      scrapeData: {
        original: scrapeResult.data,
        processed: pageData
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Fallback simulation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        step: 'exception'
      },
      { status: 500 }
    );
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
