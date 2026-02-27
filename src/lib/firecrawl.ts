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

function detectSiteType(url: string): 'documentation' | 'blog' | 'default' {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('/docs') || 
      lowerUrl.includes('documentation') || 
      lowerUrl.includes('documentacao') ||
      lowerUrl.includes('/guide') ||
      lowerUrl.includes('/manual')) {
    return 'documentation';
  }
  
  if (lowerUrl.includes('/blog') || 
      lowerUrl.includes('/posts') ||
      lowerUrl.includes('/articles')) {
    return 'blog';
  }
  
  return 'default';
}

function getCrawlParamsForSiteType(
  url: string, 
  scope: string, 
  depth: number, 
  limit: number
): { maxDepth: number; limit: number; ignoreSitemap?: boolean } {
  const siteType = detectSiteType(url);
  
  switch (siteType) {
    case 'documentation':
      return {
        maxDepth: Math.min(depth, 4),
        limit: Math.min(limit, 100)
        // sitemap é incluído automaticamente pelo Firecrawl, não precisa enviar
      };
    case 'blog':
      return {
        maxDepth: Math.min(depth, 3),
        limit: Math.min(limit, 20)
        // sitemap é incluído automaticamente pelo Firecrawl, não precisa enviar
      };
    default:
      return {
        maxDepth: Math.min(depth, 2),
        limit: Math.min(limit, 10)
      };
  }
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
    
    const siteParams = getCrawlParamsForSiteType(url, scope, depth, limit);
    const siteType = detectSiteType(url);
    
    console.log(`📊 Tipo de site detectado: ${siteType}`, siteParams);
    
    // Estrutura plana conforme a documentação da API REST v1
    let crawlParams: any = {
      url,
      maxDepth: siteParams.maxDepth,
      limit: siteParams.limit,
      scrapeOptions: {
        formats: ['markdown'],
        onlyMainContent: true
      }
    };

    // Lógica de Sitemap
    // A API do Firecrawl já busca o sitemap automaticamente por padrão
    // Só adicionamos ignoreSitemap se explicitamente solicitado
    if (siteParams.ignoreSitemap) {
      crawlParams.ignoreSitemap = true;
    }

    // Lógica de Includes (TEMPORARIAMENTE DESABILITADO PARA TESTE)
    // O includePaths estava sendo muito restritivo e filtrando todas as URLs
    // Vamos confiar no maxDepth e limit para controlar o crawl
    // TODO: Reativar com padrões mais genéricos se necessário
    /*
    if (scope === 'domain') {
      crawlParams.includePaths = [`${new URL(url).origin}/*`];
    } else if (scope === 'path') {
      const urlObj = new URL(url);
      const basePath = urlObj.pathname;
      
      // Remove a barra final se existir para evitar duplicidade no padrão
      const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      
      crawlParams.includePaths = [
        `${urlObj.origin}${cleanBasePath}/*`,
        `${urlObj.origin}${cleanBasePath}`
      ];

      // URLs problemáticas
      if (url.includes('gov.br') || url.includes('gohighlevel.com')) {
        console.log('⚠️ URL problemática detectada, removendo includePaths');
        delete crawlParams.includePaths;
      }
    }
    */

    console.log('📋 Parâmetros do crawl (REST format):', JSON.stringify(crawlParams, null, 2));

    const crawlResult = await firecrawlRequest('/crawl', crawlParams);
    
    console.log('📦 Resposta do Firecrawl:', {
      hasJobId: !!crawlResult.id || !!crawlResult.jobId,
      hasData: !!crawlResult.data,
      status: crawlResult.status,
      completed: crawlResult.completed,
      total: crawlResult.total,
      id: crawlResult.id || crawlResult.jobId
    });
    
    // Verifica ID. A resposta da v1/crawl geralmente retorna { success: true, id: "..." }
    const jobId = crawlResult.id || crawlResult.jobId;
    
    if (jobId && !crawlResult.data) {
      console.log('⏳ Crawl iniciado, fazendo polling do job:', jobId);
      return await pollCrawlJob(jobId);
    }
    
    // Caso retorne dados diretos (raro no endpoint /crawl, comum no /scrape)
    if (crawlResult.data) {
      return {
        success: true,
        data: crawlResult
      };
    }

    // Se não tem jobId nem data, pode ser que já retornou completo
    if (crawlResult.status === 'completed' || crawlResult.completed) {
      return {
        success: true,
        data: crawlResult
      };
    }

    throw new Error('Nenhum Job ID retornado pelo Firecrawl');
  } catch (error) {
    console.error('Firecrawl crawl error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function pollCrawlJob(jobId: string, maxAttempts: number = 120): Promise<CrawlResult> {
  const pollInterval = 2000; // 2 seconds
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      // API v1 usa /crawl/{id} em vez de /crawl/status/{id}
      const response = await fetch(`${FIRECRAWL_API_BASE}/crawl/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Se der erro 404 nas primeiras tentativas, pode ser delay de propagação
        if (response.status === 404 && attempts < 3) {
          console.log(`⏳ Job ID não encontrado (404), aguardando propagação...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          attempts++;
          continue;
        }
        throw new Error(`Firecrawl status check failed: ${response.status}`);
      }

      const statusResult = await response.json();
      
      console.log(`📊 Status do crawl (tentativa ${attempts + 1}/${maxAttempts}):`, {
        status: statusResult.status,
        completed: statusResult.completed,
        total: statusResult.total,
        hasData: !!statusResult.data,
        dataLength: Array.isArray(statusResult.data) ? statusResult.data.length : 'N/A'
      });

      // Na v1, o status pode ser 'completed' ou 'scraped' dependendo do contexto
      if (statusResult.status === 'completed') {
        // Quando completed, os dados estão em statusResult.data (array de páginas)
        return {
          success: true,
          data: statusResult
        };
      }

      if (statusResult.status === 'failed' || statusResult.status === 'error') {
        return {
          success: false,
          error: statusResult.error || statusResult.message || 'Crawl job failed'
        };
      }

      // Se ainda está processando (active, scraping, etc), continua polling
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    } catch (error) {
      console.error('Erro ao fazer polling do job:', error);
      attempts++;
      if (attempts >= maxAttempts) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Polling timeout'
        };
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  return {
    success: false,
    error: 'Polling timeout - job não completou a tempo'
  };
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

