/**
 * Search & Arabic Text Normalization Utility
 * Provides fast, case-insensitive, fuzzy, wildcard and diacritic-insensitive Arabic and English search.
 */

/**
 * Strips Arabic definite article (ال) if present and word length is sufficient
 */
export function stripArabicPrefix(word: string): string {
  if (!word) return '';
  if (word.startsWith('ال') && word.length > 3) {
    return word.slice(2);
  }
  return word;
}

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
      .replace(/[ىي]/g, 'ي')
      // Normalize Persian / Urdu variations if present
      .replace(/ک/g, 'ك')
      .replace(/ی/g, 'ي')
      .replace(/پ/g, 'ب')
      .replace(/چ/g, 'ج')
      .replace(/ڤ/g, 'ف')
      .replace(/گ/g, 'ك')
      // Normalize punctuation, hyphens, underscores and symbols to spaces for token matching
      .replace(/[-_./\\()[\]{}|:;,+=#*&^%$@!~`"'؟?]/g, ' ')
      // Trim and collapse multiple spaces into single space
      .trim()
      .replace(/\s+/g, ' ')
  );
}

/**
 * Checks if a candidate text matches the search query.
 * - If query is empty or whitespace, returns TRUE (wildcard: show all).
 * - Matches single characters, partial words, codes, and names.
 * - Handles Arabic definite article "ال" (e.g. "السكر" matches "سكر" and vice versa).
 */
export function matchesSearch(
  candidate: string | null | undefined,
  query: string | null | undefined
): boolean {
  // 1. If query is empty or whitespace, match all (Wildcard behavior)
  if (!query || !query.trim()) return true;
  if (!candidate) return false;

  const normCandidate = normalizeSearchText(candidate);
  const normQuery = normalizeSearchText(query);

  if (!normQuery) return true;

  // If candidate directly contains the entire query string
  if (normCandidate.includes(normQuery)) return true;

  // Split query into individual words/tokens
  const queryTokens = normQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return true;

  const candidateWords = normCandidate.split(' ').filter(Boolean);

  // Every token must match in the candidate either directly, as a substring, or without 'ال'
  return queryTokens.every((token) => {
    // Direct substring in full candidate
    if (normCandidate.includes(token)) return true;

    // Try stripping 'ال' from token (e.g. 'السكر' -> 'سكر')
    const strippedToken = stripArabicPrefix(token);
    if (strippedToken !== token && normCandidate.includes(strippedToken)) {
      return true;
    }

    // Check against individual words in candidate
    return candidateWords.some((candWord) => {
      if (candWord.includes(token)) return true;
      const strippedCandWord = stripArabicPrefix(candWord);
      if (strippedCandWord.includes(token) || strippedCandWord.includes(strippedToken)) return true;
      return false;
    });
  });
}

/**
 * Computes a relevance score for sorting matching results.
 * Higher score means a better match (exact > prefix > word prefix > substring).
 */
export function getSearchMatchScore(
  candidate: string | null | undefined,
  query: string | null | undefined
): number {
  if (!candidate || !query) return 0;
  const normCand = normalizeSearchText(candidate);
  const normQ = normalizeSearchText(query);

  if (!normQ) return 10;
  if (normCand === normQ) return 100; // Exact match
  if (normCand.startsWith(normQ)) return 85; // Prefix match

  // Check if any word starts with the query
  const words = normCand.split(' ').filter(Boolean);
  if (words.some((w) => w.startsWith(normQ))) return 70;

  if (normCand.includes(normQ)) return 50; // Substring match

  const strippedQ = stripArabicPrefix(normQ);
  if (strippedQ !== normQ && normCand.includes(strippedQ)) return 45;

  const tokens = normQ.split(' ').filter(Boolean);
  if (tokens.every((t) => normCand.includes(t) || normCand.includes(stripArabicPrefix(t)))) {
    return 30; // Multi-token match
  }

  return 10;
}

/**
 * Filters and sorts an array of entities by search query against primary, secondary and code fields.
 * If query is empty or whitespace, returns ALL items intact.
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
  if (!Array.isArray(items)) return [];
  // Wildcard: If query is empty or only whitespace, return all items immediately!
  if (!query || !query.trim()) return items;

  const trimmedQuery = query.trim();
  const results: { item: T; score: number }[] = [];

  for (const item of items) {
    const primaryVal = extractors.primary(item) || '';
    const secondaryVal = extractors.secondary ? extractors.secondary(item) || '' : '';
    const codeVal = extractors.fallbackCode ? extractors.fallbackCode(item) || '' : '';

    const primaryMatches = matchesSearch(primaryVal, trimmedQuery);
    const secondaryMatches = secondaryVal ? matchesSearch(secondaryVal, trimmedQuery) : false;
    const codeMatches = codeVal ? matchesSearch(codeVal, trimmedQuery) : false;

    if (primaryMatches || secondaryMatches || codeMatches) {
      let score = 0;
      if (primaryMatches) {
        score = Math.max(score, getSearchMatchScore(primaryVal, trimmedQuery) * 2.5);
      }
      if (secondaryMatches) {
        score = Math.max(score, getSearchMatchScore(secondaryVal, trimmedQuery) * 1.8);
      }
      if (codeMatches) {
        score = Math.max(score, getSearchMatchScore(codeVal, trimmedQuery) * 1.5);
      }
      results.push({ item, score });
    }
  }

  // Sort descending by relevance score
  results.sort((a, b) => b.score - a.score);
  return results.map((r) => r.item);
}

