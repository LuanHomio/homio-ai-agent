import { Agent } from './types';

export interface PromptMarkdownOptions {
  includeHeader?: boolean;
  includeMetadata?: boolean;
  formatLists?: boolean;
  separator?: string;
}

export function promptToMarkdown(
  agent: Agent,
  options: PromptMarkdownOptions = {}
): string {
  const {
    includeHeader = true,
    includeMetadata = false,
    formatLists = true,
    separator = '\n\n---\n\n'
  } = options;

  const sections: string[] = [];

  if (includeHeader) {
    sections.push(`# ${agent.name || 'Agente'}`);
    if (agent.description) {
      sections.push(`\n${agent.description}\n`);
    }
  }

  if (agent.personality) {
    const formatted = formatLists ? formatTextWithLists(agent.personality) : agent.personality;
    sections.push(`## 👤 Personalidade\n\n${formatted}`);
  }

  if (agent.objective) {
    const formatted = formatLists ? formatTextWithLists(agent.objective) : agent.objective;
    sections.push(`## 🎯 Objetivo\n\n${formatted}`);
  }

  if (agent.additional_info) {
    const formatted = formatLists ? formatTextWithLists(agent.additional_info) : agent.additional_info;
    sections.push(`## ℹ️ Informações Adicionais\n\n${formatted}`);
  }

  if (agent.system_prompt && agent.system_prompt.trim()) {
    const formatted = formatLists ? formatTextWithLists(agent.system_prompt) : agent.system_prompt;
    sections.push(`## 📝 System Prompt\n\n${formatted}`);
  }

  if (includeMetadata) {
    sections.push(formatMetadata(agent));
  }

  return sections.join(separator);
}

function formatTextWithLists(text: string): string {
  if (!text) return text;

  let formatted = text;

  const lines = formatted.split('\n');
  const formattedLines: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      if (inList) {
        inList = false;
      }
      formattedLines.push('');
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    const numberedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    const dashMatch = line.match(/^-\s+(.+)$/);

    if (bulletMatch || dashMatch) {
      if (!inList) {
        formattedLines.push('');
      }
      formattedLines.push(`- ${bulletMatch ? bulletMatch[1] : dashMatch![1]}`);
      inList = true;
    } else if (numberedMatch) {
      if (!inList) {
        formattedLines.push('');
      }
      formattedLines.push(`1. ${numberedMatch[1]}`);
      inList = true;
    } else {
      if (inList) {
        formattedLines.push('');
        inList = false;
      }
      formattedLines.push(line);
    }
  }

  return formattedLines.join('\n');
}

function formatMetadata(agent: Agent): string {
  const metadata: string[] = [];

  metadata.push('## 📋 Metadados\n');

  if (agent.id) {
    metadata.push(`- **ID**: \`${agent.id}\``);
  }

  if (agent.location?.name) {
    metadata.push(`- **Localização**: ${agent.location.name}`);
  }

  metadata.push(`- **Status**: ${agent.is_active ? '✅ Ativo' : '❌ Inativo'}`);

  if (agent.created_at) {
    const date = new Date(agent.created_at).toLocaleDateString('pt-BR');
    metadata.push(`- **Criado em**: ${date}`);
  }

  return metadata.join('\n');
}

export function generateSystemPrompt(agent: Agent): string {
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

  // Instruções importantes sobre uso de URLs
  parts.push(`INSTRUÇÕES CRÍTICAS SOBRE LINKS E URLs - SEGUIR RIGOROSAMENTE:
- REGRA DE OURO: Você DEVE usar APENAS e EXCLUSIVAMENTE os URLs que foram explicitamente fornecidos no contexto com "URL de referência:" ou "[Fonte: URL]".
- PROIBIÇÃO ABSOLUTA: NUNCA, em hipótese alguma, invente, modifique, construa ou adivinhe URLs baseado em palavras que você vê no texto.
- PROIBIÇÃO ABSOLUTA: NUNCA crie URLs assumindo que uma página existe. Palavras como "campanhas", "emails", "email-marketing" NÃO significam que existe uma página /docs/Campanhas/emails ou /docs/Campanhas/email-marketing.
- SE NÃO HOUVER URL NO CONTEXTO: Se o contexto mencionar um tópico mas NÃO fornecer um URL específico, você PODE mencionar o tópico mas NÃO DEVE criar, inventar ou sugerir um link. Responda sem incluir nenhum link.
- EXEMPLOS DE ERRO GRAVE (NÃO FAZER):
  * Ver "campanhas de email" no texto e criar /docs/Campanhas/emails ❌
  * Ver "email-marketing" e criar /docs/Campanhas/email-marketing ❌
  * Ver "limites de envio" e criar /docs/Campanhas/email-marketing#limites ❌
- CORRETO: Use APENAS o URL exato que foi fornecido no contexto. Se não houver URL fornecido, não inclua link algum na resposta.`);

  // Instruções sobre processamento de imagens
  parts.push(`INSTRUÇÕES SOBRE PROCESSAMENTO DE IMAGENS:
- Quando o usuário enviar uma imagem (print de erro, screenshot, foto), analise cuidadosamente o conteúdo visual.
- Para prints de erro: Identifique o tipo de erro, mensagens de erro visíveis, códigos de status, e qualquer informação relevante na tela.
- Seja descritivo e específico sobre o que você vê na imagem.
- Combine a análise da imagem com o contexto da conversa e da knowledge base para fornecer uma resposta precisa.
- Se a imagem mostrar um erro técnico, explique o problema de forma clara e sugira soluções baseadas na documentação disponível.`);

  // Instruções sobre formatação do WhatsApp
  parts.push(`INSTRUÇÕES CRÍTICAS SOBRE FORMATAÇÃO - CANAL WHATSAPP:
- IMPORTANTE: Você está respondendo via WhatsApp. NUNCA use formatação Markdown (como **negrito**, _itálico_, etc).
- Use APENAS a formatação nativa do WhatsApp:
  * *Negrito*: Use um asterisco antes e depois da palavra/frase. Exemplo: *Marketing* fica em negrito.
  * _Itálico_: Use underscore antes e depois. Exemplo: _texto_ fica em itálico.
  * ~Tachado~: Use til antes e depois. Exemplo: ~texto~ fica tachado.
  * \`\`\`Monospace\`\`\`: Use três crases antes e depois para código. Exemplo: \`\`\`código\`\`\` fica em fonte monoespaçada.
- EXEMPLOS CORRETOS:
  * "1. No menu lateral da plataforma, clique em *Marketing*." ✅
  * "Para acessar, vá em *Configurações* > *Geral*." ✅
  * "O campo _nome_ é obrigatório." ✅
  * "Use o código: \`\`\`SELECT * FROM users\`\`\`" ✅
- EXEMPLOS ERRADOS (NÃO FAZER):
  * "1. No menu lateral da plataforma, clique em **Marketing**." ❌ (Markdown não funciona no WhatsApp)
  * "Para acessar, vá em __Configurações__." ❌ (Markdown não funciona no WhatsApp)
- REGRA DE OURO: Sempre use *asteriscos* para negrito, _underscores_ para itálico, e \`\`\`crases\`\`\` para código. NUNCA use ** ou __ ou outras sintaxes de Markdown.`);

  return parts.join('\n\n') || 'Você é um assistente profissional e prestativo.';
}

