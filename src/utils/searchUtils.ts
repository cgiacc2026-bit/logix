/**
 * Search & Arabic Text Normalization Utility
 * Provides fast, case-insensitive, fuzzy and diacritic-insensitive Arabic and English search.
 */

export function normalizeSearchText(input: string | null | undefined): string {
  if (!input) return '';

  return (
    input
      .toString()
      .toLowerCase()
      // Remove Arabic Tashkeel / Harakat (Fatha, Damma, Kasra, Tanween, Shadda, Sukun, etc.)
      .replace(/[\u064B-\u0652\u0670]/g, '')
      // Remove Arabic Tatweel (Kashida)
      .replace(/\u0640/g, '')
      // Normalize Hamzas to bare Alif
      .replace(/[أإآٱ]/g, 'ا')
      // Normalize Taa Marbouta to Haa
      .replace(/ة/g, 'ه')
      // Normalize Alif Maqsura to Yaa
      .replace(/ى/g, 'ي')
      // Normalize Persian / Urdu variations if present
      .replace(/ک/g, 'ك')
      .replace(/ی/g, 'ي')
      .replace(/پ/g, 'ب')
      .replace(/چ/g, 'ج')
      .replace(/ڤ/g, 'ف')
      .replace(/گ/g, 'ك')
      // Trim and collapse multiple spaces into single space
      .trim()
      .replace(/\s+/g, ' ')
  );
}

/**
 * Checks if a candidate text matches the search query.
 * Supports multi-token partial matching (all query words must match in candidate).
 */
export function matchesSearch(
  candidate: string | null | undefined,
  query: string | null | undefined
): boolean {
  if (!query || !query.trim()) return true;
  if (!candidate) return false;

  const normCandidate = normalizeSearchText(candidate);
  const normQuery = normalizeSearchText(query);

  if (!normQuery) return true;

  // Split query into individual words/tokens
  const tokens = normQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) return true;

  // Candidate must contain all tokens (in any order)
  return tokens.every((token) => normCandidate.includes(token));
}

/**
 * Computes a relevance score for sorting matching results.
 * Higher score means a better match (e.g. prefix match > substring match).
 */
export function getSearchMatchScore(
  candidate: string | null | undefined,
  query: string | null | undefined
): number {
  if (!candidate || !query) return 0;
  const normCand = normalizeSearchText(candidate);
  const normQ = normalizeSearchText(query);

  if (normCand === normQ) return 100; // Exact match
  if (normCand.startsWith(normQ)) return 80; // Prefix match

  // Check if any word starts with the query
  const words = normCand.split(' ');
  if (words.some((w) => w.startsWith(normQ))) return 60;

  if (normCand.includes(normQ)) return 40; // Substring match

  const tokens = normQ.split(' ').filter(Boolean);
  if (tokens.every((t) => normCand.includes(t))) return 20; // Multi-token match

  return 0;
}

/**
 * Filters and sorts an array of entities by search query against primary and secondary fields.
 */
export function filterAndRankEntities<T>(
  items: T[],
  query: string,
  extractors: {
    primary: (item: T) => string | null | undefined;
    secondary?: (item: T) => string | null | undefined;
    fallbackCode?: (item: T) => string | null | undefined;
  }
): T[] {
  if (!query || !query.trim()) return items;

  const results: { item: T; score: number }[] = [];

  for (const item of items) {
    const primaryVal = extractors.primary(item) || '';
    const secondaryVal = extractors.secondary ? extractors.secondary(item) || '' : '';
    const codeVal = extractors.fallbackCode ? extractors.fallbackCode(item) || '' : '';

    const primaryMatches = matchesSearch(primaryVal, query);
    const secondaryMatches = secondaryVal ? matchesSearch(secondaryVal, query) : false;
    const codeMatches = codeVal ? matchesSearch(codeVal, query) : false;

    if (primaryMatches || secondaryMatches || codeMatches) {
      let score = 0;
      if (primaryMatches) {
        score = Math.max(score, getSearchMatchScore(primaryVal, query) * 2);
      }
      if (secondaryMatches) {
        score = Math.max(score, getSearchMatchScore(secondaryVal, query) * 1.5);
      }
      if (codeMatches) {
        score = Math.max(score, getSearchMatchScore(codeVal, query));
      }
      results.push({ item, score });
    }
  }

  // Sort descending by relevance score
  results.sort((a, b) => b.score - a.score);
  return results.map((r) => r.item);
}
