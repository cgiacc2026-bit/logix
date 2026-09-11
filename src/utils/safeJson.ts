/**
 * Universal Safe JSON and Fetch utilities to eliminate "JSON.parse: unexpected end of data"
 */

export function safeJsonParse<T>(jsonString: string | null | undefined, fallback: T): T {
  if (!jsonString || typeof jsonString !== 'string') {
    return fallback;
  }
  const trimmed = jsonString.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return fallback;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    return fallback;
  }
}

export async function safeResponseJson<T>(response: Response, fallback: T): Promise<T> {
  try {
    const text = await response.text();
    if (!text || !text.trim()) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    return fallback;
  }
}

let isApiBackendAvailable: boolean | null = null;

export async function safeApiFetch<T>(
  url: string,
  options?: RequestInit,
  fallback: T | null = null
): Promise<T | null> {
  try {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname || '';
      // If hosted on static cloud targets (e.g. Vercel, GitHub Pages, Netlify, Cloudflare Pages) where no Express backend is mounted
      if (
        hostname.endsWith('vercel.app') ||
        hostname.endsWith('github.io') ||
        hostname.endsWith('netlify.app') ||
        hostname.endsWith('pages.dev')
      ) {
        if (url.startsWith('/api/')) {
          return fallback;
        }
      }

      if (isApiBackendAvailable === false && url.startsWith('/api/')) {
        return fallback;
      }
    }

    const opts: RequestInit = { ...options };
    if (typeof window !== 'undefined') {
      const activeCompanyId = window.localStorage.getItem('supabase_company_id');
      if (activeCompanyId) {
        opts.headers = {
          'x-company-id': activeCompanyId,
          ...(opts.headers || {}),
        };
      }
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      if (res.status === 405 || res.status === 404) {
        if (url.startsWith('/api/')) {
          isApiBackendAvailable = false;
        }
      }
      return fallback;
    }
    const text = await res.text();
    if (!text || !text.trim()) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    if (url.startsWith('/api/')) {
      isApiBackendAvailable = false;
    }
    return fallback;
  }
}
