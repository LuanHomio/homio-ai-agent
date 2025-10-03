import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithFirecrawl } from '@/lib/firecrawl';

export async function POST(request: NextRequest) {
  console.log('🔍 API de teste detalhado do Firecrawl chamada');

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

    // Test URL validity
    let urlObj;
    try {
      urlObj = new URL(url);
      console.log('✅ URL válida:', {
        origin: urlObj.origin,
        pathname: urlObj.pathname,
        hostname: urlObj.hostname
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log('🚀 Iniciando teste detalhado com Firecrawl...');
    
    // Test with different parameters
    const testResults = [];

    // Test 1: Simple scrape
    console.log('🧪 Teste 1: Scrape simples');
    const scrapeResult = await scrapeWithFirecrawl(url);
    testResults.push({
      test: 'Simple Scrape',
      success: scrapeResult.success,
      error: scrapeResult.error,
      data: scrapeResult.success ? {
        url: scrapeResult.data?.data?.metadata?.sourceURL || scrapeResult.data?.metadata?.sourceURL,
        title: scrapeResult.data?.data?.metadata?.title || scrapeResult.data?.metadata?.title,
        contentLength: scrapeResult.data?.data?.markdown?.length || scrapeResult.data?.markdown?.length || 0
      } : null
    });

    // Test 2: Check if URL is accessible
    console.log('🌐 Teste 2: Verificação de acessibilidade');
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      testResults.push({
        test: 'URL Accessibility',
        success: response.ok,
        error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`,
        data: {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        }
      });
    } catch (error) {
      testResults.push({
        test: 'URL Accessibility',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null
      });
    }

    console.log('📊 Resultados dos testes:', testResults);

    const response = {
      success: scrapeResult.success,
      url,
      urlDetails: {
        origin: urlObj.origin,
        pathname: urlObj.pathname,
        hostname: urlObj.hostname
      },
      tests: testResults,
      recommendation: scrapeResult.success 
        ? 'URL funcionando perfeitamente com scrape'
        : 'URL com problemas - verificar acessibilidade ou estrutura'
    };

    console.log('📤 Enviando resposta detalhada:', response);
    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Firecrawl detailed test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
