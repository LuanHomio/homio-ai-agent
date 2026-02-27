
/**
 * Utilitário para validar links em textos gerados por IA
 */

export async function validateAndFixLinks(text: string): Promise<string> {
  // Regex para encontrar URLs em diferentes formatos:
  // 1. Markdown: [texto](url)
  // 2. Backticks: `url`
  // 3. URLs soltas: https://...
  const urlRegex = /(?:`)?(https?:\/\/[^\s\)\]`]+)/g;
  const matches = text.matchAll(urlRegex);
  const links: string[] = [];
  
  for (const match of matches) {
    links.push(match[1] || match[0]);
  }

  if (!links || links.length === 0) {
    return text;
  }

  // Remover duplicatas para não checar o mesmo link 2x
  const uniqueLinks = [...new Set(links)];
  
  // Mapear resultados da validação
  const validationResults = await Promise.all(
    uniqueLinks.map(async (url) => {
      // Limpar URL de caracteres de pontuação finais comuns em markdown
      const cleanUrl = url.replace(/[\)\],.]$/, '');
      const isValid = await checkLink(cleanUrl);
      return { original: url, clean: cleanUrl, isValid };
    })
  );

  let processedText = text;

  for (const result of validationResults) {
    if (!result.isValid) {
      console.warn(`🔗 Link quebrado detectado e removido: ${result.clean}`);
      
      // Estratégia: Remover o link mantendo o texto se for Markdown, ou remover tudo se for solto
      // 1. Substituir [texto](url_quebrada) por "texto (link indisponível)"
      const markdownLinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${escapeRegExp(result.clean)}\\)`, 'g');
      processedText = processedText.replace(markdownLinkRegex, '$1 (link indisponível)');
      
      // 2. Substituir link em backticks `url_quebrada` por "(link indisponível)"
      const backtickLinkRegex = new RegExp(`\`${escapeRegExp(result.clean)}\``, 'g');
      processedText = processedText.replace(backtickLinkRegex, '(link indisponível)');
      
      // 3. Substituir link solto url_quebrada por "(link indisponível)"
      // Usamos uma regex mais estrita aqui para evitar substituir parciais
      processedText = processedText.replace(result.clean, '(link indisponível)');
    }
  }

  return processedText;
}

async function checkLink(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // Timeout de 2s para não travar o chat

    const response = await fetch(url, {
      method: 'HEAD', // Tenta HEAD primeiro (mais leve)
      signal: controller.signal,
      headers: {
        'User-Agent': 'Homio-Link-Checker/1.0'
      }
    });

    clearTimeout(timeoutId);
    
    if (response.ok) return true;
    
    // Alguns servidores rejeitam HEAD, tenta GET se falhar com 405 (Method Not Allowed)
    if (response.status === 405) {
      const controllerGet = new AbortController();
      const timeoutGet = setTimeout(() => controllerGet.abort(), 2000);
      
      const responseGet = await fetch(url, {
        method: 'GET',
        signal: controllerGet.signal,
        headers: { 'User-Agent': 'Homio-Link-Checker/1.0' }
      });
      
      clearTimeout(timeoutGet);
      return responseGet.ok;
    }

    return false;
  } catch (error) {
    // Timeout ou erro de rede = considera inválido para segurança
    return false;
  }
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

