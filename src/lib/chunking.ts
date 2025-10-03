export interface ChunkingOptions {
  chunkSize: number;
  overlap: number;
}

export function chunkText(
  text: string, 
  options: ChunkingOptions = { chunkSize: 1000, overlap: 200 }
): string[] {
  const { chunkSize, overlap } = options;
  const chunks: string[] = [];
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;
    
    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + trimmedParagraph.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      // If single paragraph is too large, split it
      if (trimmedParagraph.length > chunkSize) {
        const subChunks = splitLargeParagraph(trimmedParagraph, chunkSize, overlap);
        chunks.push(...subChunks);
        currentChunk = '';
      } else {
        currentChunk = trimmedParagraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

function splitLargeParagraph(
  text: string, 
  chunkSize: number, 
  overlap: number
): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastSentence = text.lastIndexOf('.', end);
      const lastQuestion = text.lastIndexOf('?', end);
      const lastExclamation = text.lastIndexOf('!', end);
      
      const lastPunctuation = Math.max(lastSentence, lastQuestion, lastExclamation);
      
      if (lastPunctuation > start + chunkSize * 0.5) {
        end = lastPunctuation + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = Math.max(start + 1, end - overlap);
  }
  
  return chunks;
}

export function estimateTokenCount(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

