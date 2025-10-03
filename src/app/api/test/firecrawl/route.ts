import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithFirecrawl } from '@/lib/firecrawl';

export async function POST(request: NextRequest) {
  console.log('🧪 API de teste Firecrawl chamada');
  
  try {
    const body = await request.json();
    const { url } = body;
    
    console.log('📥 URL recebida:', url);

    if (!url) {
      console.log('❌ URL não fornecida');
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    console.log('🚀 Iniciando teste com Firecrawl...');
    // Test with a simple scrape first
    const result = await scrapeWithFirecrawl(url);
    console.log('📊 Resultado do Firecrawl:', result);

    const response = {
      success: result.success,
      error: result.error,
      data: result.success ? {
        url: result.data?.data?.metadata?.sourceURL,
        title: result.data?.data?.metadata?.title,
        contentLength: result.data?.data?.markdown?.length || 0
      } : null
    };
    
    console.log('📤 Enviando resposta:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Firecrawl test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
