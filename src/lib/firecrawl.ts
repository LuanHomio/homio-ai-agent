export interface CrawlOptions {
  url: string;
  scope: 'domain' | 'path' | 'single';
  depth: number;
  limit?: number;
}

export interface CrawlResult {
  success: boolean;
  data?: any;
  error?: string;
}

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v1';

async function firecrawlRequest(endpoint: string, data: any): Promise<any> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  const response = await fetch(`${FIRECRAWL_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || errorData.message || response.statusText;
    throw new Error(`Firecrawl API error (${response.status}): ${errorMessage}`);
  }

  return response.json();
}

export async function crawlWithFirecrawl(options: CrawlOptions): Promise<CrawlResult> {
  try {
    const { url, scope, depth, limit = 10 } = options;
    
    console.log('🚀 Iniciando crawl:', { url, scope, depth, limit });
    
    // For single page, use scrape instead of crawl
    if (scope === 'single') {
      console.log('📄 Usando scrape para página única');
      return await scrapeWithFirecrawl(url);
    }
    
    // For path scope, use more conservative parameters
    let crawlParams: any = {
      url,
      crawlerOptions: {
        maxDepth: Math.min(depth, 2), // Limit depth for path scope
        limit: Math.min(limit, 5)     // Limit pages for path scope
      },
      formats: ['markdown'],
      onlyMainContent: true
    };

    // Add includes based on scope
    if (scope === 'domain') {
      crawlParams.crawlerOptions.includes = [`${new URL(url).origin}/*`];
    } else if (scope === 'path') {
      // For path scope, be more specific with includes
      const urlObj = new URL(url);
      const basePath = urlObj.pathname;
      crawlParams.crawlerOptions.includes = [
        `${urlObj.origin}${basePath}/*`,
        `${urlObj.origin}${basePath}`
      ];
      // Also try without includes for problematic URLs
      if (url.includes('gov.br') || url.includes('gohighlevel.com')) {
        console.log('⚠️ URL problemática detectada, removendo includes');
        delete crawlParams.crawlerOptions.includes;
      }
    }

    console.log('📋 Parâmetros do crawl:', JSON.stringify(crawlParams, null, 2));

    const crawlResult = await firecrawlRequest('/crawl', crawlParams);
    
    return {
      success: true,
      data: crawlResult
    };
  } catch (error) {
    console.error('Firecrawl crawl error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function scrapeWithFirecrawl(url: string): Promise<CrawlResult> {
  try {
    const scrapeParams = {
      url,
      formats: ['markdown'],
      onlyMainContent: true
    };

    const scrapeResult = await firecrawlRequest('/scrape', scrapeParams);
    
    return {
      success: true,
      data: scrapeResult
    };
  } catch (error) {
    console.error('Firecrawl scrape error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

