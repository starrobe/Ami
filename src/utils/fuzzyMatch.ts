/**
 * Fuzzy matches a pattern against a candidate string.
 * All pattern characters must appear in order in the candidate.
 * Returns a match score (lower = better), or -1 if no match.
 */
export function fuzzyScore(pattern: string, candidate: string): number {
  const p = pattern.toLowerCase();
  const c = candidate.toLowerCase();
  let pi = 0;
  let score = 0;
  let lastMatch = -1;

  for (let ci = 0; ci < c.length && pi < p.length; ci++) {
    if (c[ci] === p[pi]) {
      if (lastMatch >= 0) {
        const gap = ci - lastMatch - 1;
        score += gap * 10; // penalty for gaps
        if (ci === lastMatch + 1) score -= 1; // bonus for consecutive
      }
      lastMatch = ci;
      pi++;
    }
  }

  if (pi < p.length) return -1; // not all chars matched
  return score;
}

/** Sort candidates by fuzzy match score. Exact prefix matches come first. */
export function fuzzySort(pattern: string, candidates: string[]): string[] {
  const scored = candidates
    .map(c => ({ c, score: fuzzyScore(pattern, c) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => {
      // Prefer shorter matches
      if (a.score !== b.score) return a.score - b.score;
      // Prefer shorter strings
      return a.c.length - b.c.length;
    });
  return scored.map(({ c }) => c);
}
