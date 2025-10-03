export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function validateScope(scope: string): scope is 'domain' | 'path' | 'single' {
  return ['domain', 'path', 'single'].includes(scope);
}

export function validateDepth(depth: number): boolean {
  return depth >= 1 && depth <= 10;
}

export function validateMode(mode: string): mode is 'direct' | 'n8n' {
  return ['direct', 'n8n'].includes(mode);
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
