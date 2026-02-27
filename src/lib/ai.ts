import OpenAI from 'openai';

const apiKey = process.env.OPENROUTER_API_KEY;

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const siteName = 'AI Agent Knowledge Base';

if (!apiKey) {
  throw new Error('OPENROUTER_API_KEY is not set');
}

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': siteUrl,
    'X-Title': siteName,
  },
});

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const cleanText = text.replace(/\n/g, ' ').trim();
    
    if (!cleanText || cleanText.length === 0) {
      throw new Error('Text is empty, cannot generate embedding');
    }

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: cleanText,
      encoding_format: 'float',
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned from OpenRouter');
    }

    return response.data[0].embedding;
  } catch (error) {
    console.error('Erro ao gerar embedding via OpenRouter:', error);
    throw error;
  }
}

