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

export async function safeApiFetch<T>(
  url: string,
  options?: RequestInit,
  fallback: T | null = null
): Promise<T | null> {
  try {
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
      return fallback;
    }
    const text = await res.text();
    if (!text || !text.trim()) {
      return fallback;
    }
    return JSON.parse(text) as T;
  } catch (error) {
    return fallback;
  }
}
