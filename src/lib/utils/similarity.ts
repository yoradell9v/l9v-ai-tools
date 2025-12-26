/**
 * String similarity utilities for duplicate detection
 */

/**
 * Calculate Levenshtein distance between two strings
 * Returns a value between 0 (identical) and max(str1.length, str2.length) (completely different)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create a matrix
  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 * Uses Levenshtein distance normalized by the maximum string length
 */
export function similarityScore(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const maxLength = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  
  return 1 - distance / maxLength;
}

/**
 * Normalize strings for comparison (lowercase, trim, remove extra spaces)
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, ""); // Remove punctuation (optional - can be adjusted)
}

/**
 * Check if two strings are similar based on normalized similarity score
 * @param str1 First string
 * @param str2 Second string
 * @param threshold Similarity threshold (0-1), default 0.85
 * @returns true if strings are similar enough
 */
export function isSimilar(
  str1: string,
  str2: string,
  threshold: number = 0.85
): boolean {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  
  // Quick check: if normalized strings are identical, they're similar
  if (normalized1 === normalized2) return true;
  
  // Calculate similarity score
  const score = similarityScore(normalized1, normalized2);
  return score >= threshold;
}

/**
 * Find the most similar string from an array
 * @param target Target string to match
 * @param candidates Array of candidate strings
 * @param threshold Minimum similarity threshold
 * @returns Object with best match and score, or null if no match above threshold
 */
export function findBestMatch(
  target: string,
  candidates: string[],
  threshold: number = 0.85
): { match: string; score: number } | null {
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = similarityScore(
      normalizeString(target),
      normalizeString(candidate)
    );
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (bestMatch && bestScore >= threshold) {
    return { match: bestMatch, score: bestScore };
  }

  return null;
}

