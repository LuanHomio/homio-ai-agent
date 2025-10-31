import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';

interface GeminiMessage {
  role: 'user' | 'model';
  parts: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }

  async generateResponse(params: {
    messages: GeminiMessage[];
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    try {
      const chat = this.model.startChat({
        history: params.messages
          .filter(msg => msg.role === 'model')
          .map(msg => ({
            role: msg.role,
            parts: [{ text: msg.parts }],
          })),
        systemInstruction: params.systemInstruction,
        generationConfig: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 8192,
        },
      });

      const lastUserMessage = params.messages
        .filter(msg => msg.role === 'user')
        .pop();

      if (!lastUserMessage) {
        throw new Error('No user message provided');
      }

      const result = await chat.sendMessage(lastUserMessage.parts);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  async generateWithRAG(params: {
    messages: GeminiMessage[];
    systemInstruction: string;
    context: string[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    response: string;
    sources: string[];
  }> {
    const contextText = params.context.length > 0
      ? '\n\nUse as seguintes informações como contexto para responder:\n\n' + params.context.join('\n\n---\n\n')
      : '';

    const userMessage = params.messages[params.messages.length - 1];
    const enhancedUserMessage = {
      role: 'user' as const,
      parts: userMessage.parts + contextText
    };

    const response = await this.generateResponse({
      messages: [enhancedUserMessage],
      systemInstruction: params.systemInstruction,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    return {
      response,
      sources: [],
    };
  }
}

export const gemini = new GeminiService();

