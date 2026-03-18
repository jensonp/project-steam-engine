const HTTP_PROTOCOL_REGEX = /^https?:\/\//i;
const PROTOCOL_RELATIVE_REGEX = /^\/\//;

/**
 * Normalize configured API base URL to a fully-qualified absolute URL.
 * This prevents production misconfigurations like "api.example.com"
 * from being treated by the browser as a relative path.
 */
export function normalizeApiUrl(rawUrl: string | null | undefined): string {
  const fallbackUrl = 'http://localhost:3000';
  const trimmed = (rawUrl || '').trim();

  if (!trimmed) {
    return fallbackUrl;
  }

  let normalized = trimmed;

  if (PROTOCOL_RELATIVE_REGEX.test(normalized)) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    normalized = `${protocol}${normalized}`;
  } else if (!HTTP_PROTOCOL_REGEX.test(normalized) && !normalized.startsWith('/')) {
    normalized = `https://${normalized}`;
  } else if (normalized.startsWith('/')) {
    if (typeof window !== 'undefined') {
      normalized = `${window.location.origin}${normalized}`;
    } else {
      normalized = `${fallbackUrl}${normalized}`;
    }
  }

  return normalized.replace(/\/+$/, '');
}
