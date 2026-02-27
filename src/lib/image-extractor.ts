
/**
 * Utilitário para extrair URLs de imagens de mensagens recebidas
 */

export function extractImageUrls(rawPayload: any): string[] {
  const imageUrls: string[] = [];

  if (!rawPayload || typeof rawPayload !== 'object') {
    return imageUrls;
  }

  // GHL pode enviar imagens em diferentes formatos
  // Formato 1: media array
  if (Array.isArray(rawPayload.media)) {
    rawPayload.media.forEach((media: any) => {
      if (media.url || media.mediaUrl) {
        imageUrls.push(media.url || media.mediaUrl);
      }
    });
  }

  // Formato 2: attachments array
  if (Array.isArray(rawPayload.attachments)) {
    rawPayload.attachments.forEach((attachment: any) => {
      if (attachment.type === 'image' && (attachment.url || attachment.mediaUrl)) {
        imageUrls.push(attachment.url || attachment.mediaUrl);
      }
    });
  }

  // Formato 3: mediaUrl direto
  if (rawPayload.mediaUrl && typeof rawPayload.mediaUrl === 'string') {
    imageUrls.push(rawPayload.mediaUrl);
  }

  // Formato 4: media.url
  if (rawPayload.media?.url) {
    imageUrls.push(rawPayload.media.url);
  }

  // Formato 5: body pode conter URLs de imagens
  if (rawPayload.body) {
    const urlRegex = /(https?:\/\/[^\s\)]+\.(jpg|jpeg|png|gif|webp|heic|heif))/gi;
    const matches = rawPayload.body.match(urlRegex);
    if (matches) {
      imageUrls.push(...matches);
    }
  }

  // Remover duplicatas
  return [...new Set(imageUrls)];
}

