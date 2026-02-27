import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';

interface GeminiMessage {
  role: 'user' | 'model';
  parts: string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
  images?: string[]; // URLs de imagens
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  private async downloadImageAsBase64(imageUrl: string): Promise<{ mimeType: string; data: string }> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Converter ArrayBuffer para base64 sem usar Buffer (compatível com Edge Runtime)
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      return {
        mimeType: contentType,
        data: base64
      };
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }

  private async prepareMessageParts(
    text: string, 
    imageUrls?: string[]
  ): Promise<Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>> {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (text) {
      parts.push({ text });
    }

    if (imageUrls && imageUrls.length > 0) {
      for (const imageUrl of imageUrls) {
        try {
          const imageData = await this.downloadImageAsBase64(imageUrl);
          parts.push({ inlineData: imageData });
        } catch (error) {
          console.error(`Failed to process image ${imageUrl}:`, error);
        }
      }
    }

    return parts;
  }

  async generateResponse(params: {
    messages: GeminiMessage[];
    systemInstruction?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    try {
      // Separar histórico (todas exceto a última) e mensagem atual (última)
      const historyMessages = params.messages.slice(0, -1);
      const currentMessage = params.messages[params.messages.length - 1];

      if (!currentMessage || currentMessage.role !== 'user') {
        throw new Error('Last message must be from user');
      }

      // Preparar histórico (sem imagens no histórico por enquanto, apenas texto)
      const history = await Promise.all(
        historyMessages.map(async (msg) => {
          const text = typeof msg.parts === 'string' ? msg.parts : msg.parts.find(p => p.text)?.text || '';
          return {
            role: msg.role,
            parts: [{ text }],
          };
        })
      );

      // Preparar mensagem atual com texto e imagens
      const currentText = typeof currentMessage.parts === 'string' 
        ? currentMessage.parts 
        : currentMessage.parts.find(p => p.text)?.text || '';
      
      const imageUrls = currentMessage.images || [];
      const currentParts = await this.prepareMessageParts(currentText, imageUrls);

      const chat = this.model.startChat({
        history: history,
        systemInstruction: params.systemInstruction,
        generationConfig: {
          temperature: params.temperature ?? 0.7,
          maxOutputTokens: params.maxTokens ?? 8192,
        },
      });

      const result = await chat.sendMessage(currentParts);
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
    imageUrls?: string[];
  }): Promise<{
    response: string;
    sources: string[];
  }> {
    const contextText = params.context.length > 0
      ? '\n\nUse as seguintes informações como contexto para responder:\n\n' + params.context.join('\n\n---\n\n')
      : '';

    // Separar histórico de mensagens anteriores e mensagem atual
    const lastMessage = params.messages[params.messages.length - 1];
    const historyMessages = params.messages.slice(0, -1);

    // Adicionar contexto à última mensagem do usuário
    const lastMessageText = typeof lastMessage.parts === 'string' 
      ? lastMessage.parts 
      : lastMessage.parts.find(p => p.text)?.text || '';
    
    const enhancedLastMessage: GeminiMessage = {
      role: lastMessage.role,
      parts: lastMessageText + contextText,
      images: params.imageUrls || lastMessage.images || []
    };

    // Combinar histórico + mensagem atual com contexto
    const allMessages = [...historyMessages, enhancedLastMessage];

    const response = await this.generateResponse({
      messages: allMessages,
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

